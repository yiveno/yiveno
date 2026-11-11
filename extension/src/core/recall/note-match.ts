/**
 * 命题命中（note match）：一次查询内构建的命题命中集。
 * 纯函数为主；IndexedDB 扫描由 findNoteMatchesForQuery 做（fail-open）。
 * 佐证门（设计稿 §2）与虚拟字段评分（§5.3）共用同一集；不挂 MemoryItem，不写 clues，不进倒排。
 */

import {
  fieldCorroboratesTerm,
  itemCorroboratesContentTerms,
  normalizeContentTermsForCorroboration
} from '@/core/recall/content-term-corroboration'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { NoteProvenance } from '@/core/recall/recall-result'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'
import { logger } from '@/infrastructure/logging/logger'

/** 查询侧 note 扫描上限（设计稿 §5.4 / §10：≤2000 行/查询）。 */
export const DREAMING_NOTE_SCAN_LIMIT = 2000 as const
/** 每查询最多附加的源条目 id 数（设计稿 §5.4 / §10：≤100）。 */
export const DREAMING_NOTE_MAX_ATTACHED_SOURCES = 100 as const

/** 一次查询的命题命中集：源条目 id → 该源的最优命题出处。 */
export type NoteMatchSet = ReadonlyMap<string, NoteProvenance>

/** 扫描阶段的候选：一条命题 + 它命中的 effective terms（尚未做存活/过期判定）。 */
export interface NoteMatchCandidate {
  note: MemoryNoteRecord
  matchedTerms: string[]
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
function noteTextMatchesTerm(note: MemoryNoteRecord, term: string): boolean {
  if (fieldCorroboratesTerm(note.text, term)) {
    return true
  }
  return note.topicAnchor.some(anchor => fieldCorroboratesTerm(anchor, term))
}

/**
 * 扫描命题表，返回按源取最优后的候选（每源 1 条：匹配词数最多；并列取 propositionIndex 最小）。
 * fail-open：扫描抛错 → 空数组 + 日志，查询继续。
 * 不做存活/过期判定（那需要条目，由 buildNoteMatchSet 在合并后做）。
 * 可注入 scan（测试用）；默认用 memoryNotesRepository.listByOwnerUpdated。
 */
export async function findNoteMatchesForQuery(input: {
  ownerId: string
  contentTerms: readonly string[]
  scan?: (args: { ownerId: string; limit: number }) => Promise<MemoryNoteRecord[]>
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
  const bestBySource = new Map<string, NoteMatchCandidate>()
  for (const note of rows) {
    const matchedTerms = terms.filter(term => noteTextMatchesTerm(note, term))
    if (matchedTerms.length === 0) {
      continue
    }
    const candidate: NoteMatchCandidate = { note, matchedTerms }
    const existing = bestBySource.get(note.sourceMemoryItemId)
    if (!existing) {
      bestBySource.set(note.sourceMemoryItemId, candidate)
      continue
    }
    if (
      matchedTerms.length > existing.matchedTerms.length ||
      (matchedTerms.length === existing.matchedTerms.length &&
        notePropositionIndex(note) < notePropositionIndex(existing.note))
    ) {
      bestBySource.set(note.sourceMemoryItemId, candidate)
    }
  }
  return [...bestBySource.values()].slice(0, DREAMING_NOTE_MAX_ATTACHED_SOURCES)
}

/**
 * 从候选 + 最终候选池构建命题命中集（一次查询内构建一次，供三处硬滤点共用）。
 * 过滤（全须满足，否则该候选不进集）：
 * - 源在最终候选池内（itemsById 含该 id；设计稿 §2.2 条件 3）；
 * - 源存活（`deletedAt == null`；条件 4）；
 * - 命题未过期（源 `updatedAt` ≤ 命题 `sourceUpdatedAt`；条件 5）。
 * 每源只留最优一条（匹配词数最多；并列取 propositionIndex 最小）。
 * soleCorroboration 由同一判定函数在判定时刻出：源条目无任何字面佐证时为 true。
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
    if (candidate.matchedTerms.length === 0) {
      continue
    }
    const existing = out.get(item.id)
    if (
      existing &&
      (existing.matchedTerms.length > candidate.matchedTerms.length ||
        (existing.matchedTerms.length === candidate.matchedTerms.length &&
          existing.propositionIndex <= notePropositionIndex(candidate.note)))
    ) {
      continue
    }
    out.set(item.id, {
      noteId: candidate.note.id,
      sourceMemoryItemId: item.id,
      matchedTerms: [...candidate.matchedTerms],
      soleCorroboration: !itemCorroboratesContentTerms(item, terms),
      propositionText: candidate.note.text,
      topicAnchor: [...candidate.note.topicAnchor],
      propositionIndex: notePropositionIndex(candidate.note)
    })
  }
  return out
}
