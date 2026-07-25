import { RECALL_TOP_PICK_MIN_SCORE, filterMemoryItemsByKeyword } from '@/core/recall/keyword-filter'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 由命中列表构建 Recall 结果。 */
export function buildRecallResult(clue: string, matches: RecallMatch[]): RecallResult {
  if (matches.length === 0) {
    return {
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      clue
    }
  }

  const best = matches[0]
  if (!best || best.score < RECALL_TOP_PICK_MIN_SCORE) {
    return {
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      clue
    }
  }

  return {
    outcome: 'top_pick',
    topPick: best,
    alsoPossible: matches.slice(1, 6),
    clue
  }
}

/** 对 MemoryItem 列表执行关键词 Recall。 */
export function recallByKeyword(
  items: MemoryItem[],
  clue: string,
  options: { candidateLimit?: number; nowMs?: number } = {}
): RecallResult {
  const matches = filterMemoryItemsByKeyword(items, clue, {
    limit: (options.candidateLimit ?? 6) + 5,
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs })
  })

  const trimmed = matches.slice(0, options.candidateLimit ?? 6)
  return buildRecallResult(clue, trimmed)
}
