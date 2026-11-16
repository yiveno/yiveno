/**
 * 命题命中（note match）：一次查询内构建的命题命中集。
 * 纯函数为主；IndexedDB 扫描由 findNoteMatchesForQuery 做（fail-open）。
 * 佐证门（设计稿 §2）与虚拟字段评分（§5.3）共用同一集；不挂 MemoryItem，不写 clues，不进倒排。
 * Phase 4.1：语义谓词（rule 0b）与字面入同一集；字面永远优先于语义。
 */

import {
  fieldCorroboratesTerm,
  itemCorroboratesContentTerms,
  normalizeContentTermsForCorroboration
} from '@/core/recall/content-term-corroboration'
import { cosineSimilarity } from '@/core/recall/hybrid-fusion'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { NoteProvenance } from '@/core/recall/recall-result'
import { memoryNoteEmbeddingRepository } from '@/infrastructure/indexeddb/memory-note-embedding-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'
import { logger } from '@/infrastructure/logging/logger'

/** 查询侧 note 扫描上限（设计稿 §5.4 / §10：≤2000 行/查询）。 */
export const DREAMING_NOTE_SCAN_LIMIT = 2000 as const
/** 每查询最多附加的源条目 id 数（设计稿 §5.4 / §10：≤100）。 */
export const DREAMING_NOTE_MAX_ATTACHED_SOURCES = 100 as const

/** 一次查询的命题命中集：源条目 id → 该源的最优命题出处。 */
export type NoteMatchSet = ReadonlyMap<string, NoteProvenance>

/** 命中种类：字面（rule 0）或语义（rule 0b）。 */
export type NoteMatchKind = 'literal' | 'semantic'

/** 扫描阶段的候选：一条命题 + 它命中的 effective terms（尚未做存活/过期判定）。 */
export interface NoteMatchCandidate {
  note: MemoryNoteRecord
  matchedTerms: string[]
  /** 缺省按 literal（兼容既有 eval 直构）。 */
  matchKind?: NoteMatchKind
  /** 语义命中时的余弦相似度；字面命中不填。 */
  semanticScore?: number
}

/**
 * 命题行的 propositionIndex：MemoryNoteRecord 无独立 index 字段；
 * 从 note.id 的第三段（`${ownerId}\0${sourceId}\0${index}`）解析；取不到取 0。
 */
function notePropositionIndex(note: MemoryNoteRecord): number {
  const fromId = Number(note.id.split('\0')[2] ?? NaN)
  return Number.isFinite(fromId) ? fromId : 0
}

/** 第 0 条：至少一个 effective content term 在命题 text 或 topicAnchor 内有字面命中。 */
export function noteTextMatchesTerm(note: MemoryNoteRecord, term: string): boolean {
  if (fieldCorroboratesTerm(note.text, term)) {
    return true
  }
  return note.topicAnchor.some(anchor => fieldCorroboratesTerm(anchor, term))
}

function candidateKind(candidate: NoteMatchCandidate): NoteMatchKind {
  return candidate.matchKind ?? 'literal'
}

/** 字面永远优于语义；同种内按词数/相似度，再按 propositionIndex。 */
function isBetterCandidate(next: NoteMatchCandidate, existing: NoteMatchCandidate): boolean {
  const nextKind = candidateKind(next)
  const existingKind = candidateKind(existing)
  if (nextKind !== existingKind) {
    return nextKind === 'literal'
  }
  if (nextKind === 'literal') {
    if (next.matchedTerms.length !== existing.matchedTerms.length) {
      return next.matchedTerms.length > existing.matchedTerms.length
    }
    return notePropositionIndex(next.note) < notePropositionIndex(existing.note)
  }
  const nextScore = next.semanticScore ?? 0
  const existingScore = existing.semanticScore ?? 0
  if (nextScore !== existingScore) {
    return nextScore > existingScore
  }
  return notePropositionIndex(next.note) < notePropositionIndex(existing.note)
}

/**
 * 扫描命题表，返回按源取最优后的候选（每源 1 条）。
 * 排序：字面优先；同种内按词数/相似度；并列取 propositionIndex 最小。
 * fail-open：扫描抛错 → 空数组 + 日志，查询继续。
 * 不做存活/过期判定（那需要条目，由 buildNoteMatchSet 在合并后做）。
 * 可注入 scan / loadEmbeddings（测试用）。
 */
export async function findNoteMatchesForQuery(input: {
  ownerId: string
  contentTerms: readonly string[]
  scan?: (args: { ownerId: string; limit: number }) => Promise<MemoryNoteRecord[]>
  /** 语义匹配：查询向量（Hybrid 同路复用）；缺省则只走字面。 */
  queryVector?: ArrayLike<number> | null
  /** 语义子开关（与 prefer-read 双重门控由调用方保证）。 */
  semanticEnabled?: boolean
  /** rule 0b 阈值。 */
  semanticMinSimilarity?: number
  loadEmbeddings?: (noteIds: readonly string[]) => Promise<ReadonlyMap<string, ArrayLike<number>>>
}): Promise<NoteMatchCandidate[]> {
  const terms = normalizeContentTermsForCorroboration(input.contentTerms)
  if (terms.length === 0) {
    return []
  }
  const scan = input.scan ?? (args => memoryNotesRepository.listByOwnerUpdated(args))
  let rows: MemoryNoteRecord[]
  try {
    rows = await scan({ ownerId: input.ownerId, limit: DREAMING_NOTE_SCAN_LIMIT })
  } catch (error) {
    logger.warn('Dreaming', '命题扫描失败，降级为空集', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }

  const semanticEnabled =
    input.semanticEnabled === true &&
    input.queryVector != null &&
    input.queryVector.length > 0 &&
    typeof input.semanticMinSimilarity === 'number'

  let embeddingByNoteId: ReadonlyMap<string, ArrayLike<number>> = new Map()
  if (semanticEnabled) {
    const load =
      input.loadEmbeddings ??
      (async (noteIds: readonly string[]) => {
        const loaded = await memoryNoteEmbeddingRepository.getManyByIds(noteIds)
        const map = new Map<string, ArrayLike<number>>()
        for (const [id, row] of loaded) {
          map.set(id, row.embedding)
        }
        return map
      })
    try {
      embeddingByNoteId = await load(rows.map(row => row.id))
    } catch (error) {
      logger.warn('Dreaming', '命题向量加载失败，语义匹配跳过', {
        error: error instanceof Error ? error.message : String(error)
      })
      embeddingByNoteId = new Map()
    }
  }

  const bestBySource = new Map<string, NoteMatchCandidate>()
  for (const note of rows) {
    const matchedTerms = terms.filter(term => noteTextMatchesTerm(note, term))
    let candidate: NoteMatchCandidate | null = null
    if (matchedTerms.length > 0) {
      candidate = { note, matchedTerms, matchKind: 'literal' }
    } else if (semanticEnabled) {
      const embedding = embeddingByNoteId.get(note.id)
      if (embedding != null && embedding.length === input.queryVector!.length) {
        const similarity = cosineSimilarity(input.queryVector!, embedding)
        if (similarity >= input.semanticMinSimilarity!) {
          candidate = {
            note,
            matchedTerms: [],
            matchKind: 'semantic',
            semanticScore: similarity
          }
        }
      }
    }
    if (!candidate) {
      continue
    }
    const existing = bestBySource.get(note.sourceMemoryItemId)
    if (!existing || isBetterCandidate(candidate, existing)) {
      bestBySource.set(note.sourceMemoryItemId, candidate)
    }
  }
  return [...bestBySource.values()].slice(0, DREAMING_NOTE_MAX_ATTACHED_SOURCES)
}

/**
 * 从候选 + 最终候选池构建命题命中集（一次查询内构建一次，供硬滤点共用）。
 * 过滤（全须满足，否则该候选不进集）：
 * - 源在最终候选池内（itemsById 含该 id；设计稿 §2.2 条件 3）；
 * - 源存活（`deletedAt == null`；条件 4）；
 * - 命题未过期（源 `updatedAt` ≤ 命题 `sourceUpdatedAt`；条件 5）。
 * 语义独占：matchedTerms 可空，但 matchKind=semantic 且须有 semanticScore。
 * soleCorroboration：源条目无任何字面佐证时为 true（语义独占亦置 sole）。
 */
export function buildNoteMatchSet(
  candidates: readonly NoteMatchCandidate[],
  itemsById: ReadonlyMap<string, MemoryItem>,
  contentTerms: readonly string[]
): NoteMatchSet {
  const terms = normalizeContentTermsForCorroboration(contentTerms)
  const out = new Map<string, NoteProvenance>()
  for (const candidate of candidates) {
    const item = itemsById.get(candidate.note.sourceMemoryItemId)
    if (!item || item.deletedAt != null) {
      continue
    }
    if (item.updatedAt > candidate.note.sourceUpdatedAt) {
      continue
    }
    const kind = candidateKind(candidate)
    if (kind === 'literal' && candidate.matchedTerms.length === 0) {
      continue
    }
    if (
      kind === 'semantic' &&
      (candidate.semanticScore == null || !Number.isFinite(candidate.semanticScore))
    ) {
      continue
    }
    const existing = out.get(item.id)
    if (existing && !isBetterThanProvenance(candidate, existing)) {
      continue
    }
    out.set(item.id, {
      noteId: candidate.note.id,
      sourceMemoryItemId: item.id,
      matchedTerms: [...candidate.matchedTerms],
      soleCorroboration: !itemCorroboratesContentTerms(item, terms),
      propositionText: candidate.note.text,
      topicAnchor: [...candidate.note.topicAnchor],
      propositionIndex: notePropositionIndex(candidate.note),
      matchKind: kind,
      ...(candidate.semanticScore != null ? { semanticScore: candidate.semanticScore } : {})
    })
  }
  return out
}

/** 候选是否优于已写入的 NoteProvenance（字面优先；同种内词数/相似度）。 */
function isBetterThanProvenance(candidate: NoteMatchCandidate, existing: NoteProvenance): boolean {
  const kind = candidateKind(candidate)
  const existingKind = existing.matchKind ?? 'literal'
  if (kind !== existingKind) {
    return kind === 'literal'
  }
  if (kind === 'literal') {
    if (candidate.matchedTerms.length !== existing.matchedTerms.length) {
      return candidate.matchedTerms.length > existing.matchedTerms.length
    }
    return notePropositionIndex(candidate.note) < existing.propositionIndex
  }
  const nextScore = candidate.semanticScore ?? 0
  const existingScore = existing.semanticScore ?? 0
  if (nextScore !== existingScore) {
    return nextScore > existingScore
  }
  return notePropositionIndex(candidate.note) < existing.propositionIndex
}
