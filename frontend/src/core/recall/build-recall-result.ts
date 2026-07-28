import { RECALL_TOP_PICK_MIN_SCORE, filterMemoryItemsByKeyword } from '@/core/recall/keyword-filter'
import {
  collapseRecallMatches,
  recallMatchConflictsWithTopPick
} from '@/core/recall/collapse-recall-duplicates'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 展示名额：Top Pick + Also Possible。 */
export const RECALL_RESULT_SLOT_LIMIT = 6

/**
 * 折叠前保留的命中上限。
 * 须足够大，避免同键成员被提前截断导致 stacks 计数偏小/偏大错觉。
 */
export const RECALL_MATCH_FETCH_LIMIT = 500

/** Also 回填时多取的折叠组余量（供域名互斥过滤后补位）。 */
export const RECALL_COLLAPSE_BACKFILL_EXTRA = 12

/** 由已折叠的互异组构建结果；Also 相对 Top 互斥（同键 / 同书签域名）。 */
export function buildRecallResult(clue: string, collapsedGroups: RecallMatch[]): RecallResult {
  if (collapsedGroups.length === 0) {
    return {
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      clue
    }
  }

  const best = collapsedGroups[0]
  if (!best) {
    return {
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      clue
    }
  }

  // 有词面命中但未达 Top Pick：Need A Clue（展示弱候选，请用户再补线索）
  if (best.score < RECALL_TOP_PICK_MIN_SCORE) {
    return {
      outcome: 'need_a_clue',
      topPick: null,
      alsoPossible: collapsedGroups.slice(0, RECALL_RESULT_SLOT_LIMIT),
      clue
    }
  }

  const alsoLimit = RECALL_RESULT_SLOT_LIMIT - 1
  const alsoPossible: RecallMatch[] = []
  for (const candidate of collapsedGroups.slice(1)) {
    if (recallMatchConflictsWithTopPick(best, candidate)) {
      continue
    }
    alsoPossible.push(candidate)
    if (alsoPossible.length >= alsoLimit) {
      break
    }
  }

  return {
    outcome: 'top_pick',
    topPick: best,
    alsoPossible,
    clue
  }
}

/** 对 MemoryItem 列表执行关键词 Recall（含重复折叠与 Top/Also 互斥）。 */
export function recallByKeyword(
  items: MemoryItem[],
  clue: string,
  options: { candidateLimit?: number; nowMs?: number } = {}
): RecallResult {
  const slotLimit = options.candidateLimit ?? RECALL_RESULT_SLOT_LIMIT
  const matches = filterMemoryItemsByKeyword(items, clue, {
    limit: RECALL_MATCH_FETCH_LIMIT,
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs })
  })

  const collapsed = collapseRecallMatches(matches, {
    limit: slotLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
  return buildRecallResult(clue, collapsed)
}
