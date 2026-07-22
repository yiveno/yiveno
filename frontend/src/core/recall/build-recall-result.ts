import { RECALL_MIN_MATCH_SCORE, filterMemoryItemsByKeyword } from '@/core/recall/keyword-filter'
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

  const [best, ...rest] = matches
  if (best.score < RECALL_MIN_MATCH_SCORE) {
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
    alsoPossible: rest.slice(0, 5),
    clue
  }
}

/** 对 MemoryItem 列表执行关键词 Recall。 */
export function recallByKeyword(
  items: MemoryItem[],
  clue: string,
  options: { candidateLimit?: number } = {}
): RecallResult {
  const matches = filterMemoryItemsByKeyword(items, clue, {
    limit: (options.candidateLimit ?? 6) + 5
  })

  const trimmed = matches.slice(0, options.candidateLimit ?? 6)
  return buildRecallResult(clue, trimmed)
}
