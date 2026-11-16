/**
 * Dreaming Phase 4 / 4.1：候选加载分流的命题合并（设计稿 §5）。
 * 调用点在 recallWithClue：listForKeywordRecall 返回之后、excludeDismissedMemoryItems 之前。
 * fail-open：ownerId 解析失败 / 扫描失败 / 取源失败 → 空集 + 日志，查询继续。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  DREAMING_SEMANTIC_NOTE_MATCH_ENABLED,
  DREAMING_SEMANTIC_NOTE_MATCH_MIN_SIMILARITY
} from '@/core/dreaming/dreaming-constants'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  buildNoteMatchSet,
  findNoteMatchesForQuery,
  type NoteMatchCandidate,
  type NoteMatchSet
} from '@/core/recall/note-match'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryNotesMetaRepository } from '@/infrastructure/indexeddb/memory-notes-meta-repository'
import { logger } from '@/infrastructure/logging/logger'

export interface NoteMergeResult {
  /** 合并后的候选池（倒排模式下命题源追加到池尾，不扰动既有顺序；扫描模式下等于原池）。 */
  items: MemoryItem[]
  /** 最终命题命中集（供三处硬滤点共用）。 */
  noteMatches: NoteMatchSet
  /** 本轮实际解析到的 ownerId（供命中计数用；解析失败时为 null）。 */
  ownerId: string | null
}

/**
 * 命题合并。调用方须先保证：非 Omnibox 入口（`if (!isOmniboxEntry)` 守卫在调用处）。
 * 跳过条件（任一满足即不扫，直接返回原池 + 空集）：
 * - effective content terms 为空；
 * - `memory_notes_meta` 的 itemCount == 0（该用户无命题，零成本跳过；读 meta 失败视为未知，不跳过）；
 * - 开关 DREAMING_PREFER_READ_ENABLED 为 false（由 `preferReadEnabled` 传入）。
 *
 * 语义匹配双重门控：`preferReadEnabled` ON **且** 语义子开关 ON，且传入 queryVector；
 * 否则只走字面。
 */
export async function mergeNoteMatchesForRecall(input: {
  listedItems: MemoryItem[]
  /** listForKeywordRecall 返回的 source：'inverted' | 'scan'。 */
  listedSource: string
  contentTerms: readonly string[]
  preferReadEnabled: boolean
  /** Hybrid 同路复用的查询向量；缺省 / 空 → 语义静默跳过。 */
  queryVector?: ArrayLike<number> | null
  /** 测试可覆盖语义子开关；缺省读常量。 */
  semanticEnabled?: boolean
  /** 测试可覆盖阈值。 */
  semanticMinSimilarity?: number
}): Promise<NoteMergeResult> {
  const empty: NoteMergeResult = { items: input.listedItems, noteMatches: new Map(), ownerId: null }
  if (!input.preferReadEnabled || input.contentTerms.length === 0) {
    return empty
  }

  let ownerId: string | null = null
  try {
    ownerId = await getCurrentOwnerId()
  } catch (error) {
    logger.warn('Dreaming', 'ownerId 解析失败，跳过命题合并', {
      error: error instanceof Error ? error.message : String(error)
    })
    return empty
  }
  if (!ownerId) {
    return empty
  }

  try {
    const meta = await memoryNotesMetaRepository.getMeta(ownerId)
    if (meta && meta.itemCount === 0) {
      return { ...empty, ownerId }
    }
  } catch (error) {
    logger.warn('Dreaming', '命题 meta 读取失败，继续扫描', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  const allowSemantic =
    (input.semanticEnabled ?? DREAMING_SEMANTIC_NOTE_MATCH_ENABLED) === true &&
    input.queryVector != null &&
    input.queryVector.length > 0

  const candidates: NoteMatchCandidate[] = await findNoteMatchesForQuery({
    ownerId,
    contentTerms: input.contentTerms,
    ...(allowSemantic
      ? {
          queryVector: input.queryVector,
          semanticEnabled: true,
          semanticMinSimilarity:
            input.semanticMinSimilarity ?? DREAMING_SEMANTIC_NOTE_MATCH_MIN_SIMILARITY
        }
      : {})
  })
  if (candidates.length === 0) {
    return { ...empty, ownerId }
  }

  // 倒排模式：命题命中的源 id 经 getById 取回（软删由 getById 默认过滤），去重后追加到池尾。
  // 扫描模式：池已是全表（上限内），跳过补 id；池内源的命题命中仍可经 note-match 集获得佐证。
  let items = input.listedItems
  if (input.listedSource !== 'scan') {
    const existingIds = new Set(items.map(item => item.id))
    let merged = [...items]
    for (const candidate of candidates) {
      const sourceId = candidate.note.sourceMemoryItemId
      if (existingIds.has(sourceId)) {
        continue
      }
      try {
        const source = await memoryItemService.getById(sourceId)
        if (source && source.deletedAt == null) {
          merged = [...merged, source]
          existingIds.add(sourceId)
        }
      } catch (error) {
        logger.warn('Dreaming', '命题源取回失败，跳过该源', {
          sourceId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    items = merged
  }

  const itemsById = new Map(items.map(item => [item.id, item]))
  const noteMatches = buildNoteMatchSet(candidates, itemsById, input.contentTerms)
  return { items, noteMatches, ownerId }
}
