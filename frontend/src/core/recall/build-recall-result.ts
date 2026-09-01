import {
  RECALL_TOP_PICK_MIN_SCORE,
  filterMemoryItemsByKeyword,
  recallTopPickBlockedByGenericPageTitleGate
} from '@/core/recall/keyword-filter'
import {
  collapseRecallMatches,
  recallMatchConflictsWithTopPick
} from '@/core/recall/collapse-recall-duplicates'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import type { MemoryItem } from '@/core/memory/memory-item'

/**
 * 第一屏 / 每批「Show more」条数（互异组）。
 * 产品：默认短名单，可续展；不是结果全集上限。
 * eval `in_topk` k≤5 对齐本常量。
 */
export const RECALL_RESULT_PAGE_SIZE = 5

/**
 * 单轮 Recall UI 同时挂载的结果卡软顶（Show all 不超过此值，防长邻域撑爆 DOM）。
 * 排序池仍可大于此值；Framing 文案用 rankedTotalCount 诚实披露。
 */
export const RECALL_RESULT_MAX_VISIBLE_DOM = 20

/**
 * 交给 UI 的排序池软顶（折叠+互斥后）。
 * 超过此数仍截断；文案用 totalRankedCount 告知用户池内条数。
 */
export const RECALL_RESULT_POOL_LIMIT = 50

/** 折叠时多取的余量（供域名互斥过滤后补位到池上限）。 */
export const RECALL_COLLAPSE_BACKFILL_EXTRA = 24

/**
 * 折叠前关键词打分：候选已由倒排/扫窗口裁过，此处**全量**保留 ≥minScore 命中。
 * 若先按条数截断，同 URL 重复书签会占满名额（例：js-cookie×499 挡住「现代 JavaScript 教程」）。
 */
export function filterKeywordMatchesBeforeCollapse(
  items: MemoryItem[],
  clue: string,
  options: { nowMs?: number; minScore?: number } = {}
): RecallMatch[] {
  return filterMemoryItemsByKeyword(items, clue, {
    // 至少 1，避免空数组时 limit 默认 6 的误导；有候选则全收
    limit: Math.max(items.length, 1),
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }),
    ...(options.minScore === undefined ? {} : { minScore: options.minScore })
  })
}

/** 组装空结果。 */
function emptyRecallResult(clue: string): RecallResult {
  return {
    outcome: 'no_match',
    topPick: null,
    alsoPossible: [],
    totalRankedCount: 0,
    clue
  }
}

/**
 * 从已折叠组构建排序池（≤ {@link RECALL_RESULT_POOL_LIMIT}）。
 * - withTopConflictFilter：相对头名做同站/同键互斥（top_pick 路径）
 * - 否则按序截取（need_a_clue 弱候选）
 */
export function buildRankedRecallPool(
  collapsedGroups: RecallMatch[],
  options: { withTopConflictFilter: boolean }
): RecallMatch[] {
  if (collapsedGroups.length === 0) {
    return []
  }

  if (!options.withTopConflictFilter) {
    return collapsedGroups.slice(0, RECALL_RESULT_POOL_LIMIT)
  }

  const best = collapsedGroups[0]
  if (!best) {
    return []
  }

  const pool: RecallMatch[] = [best]
  for (const candidate of collapsedGroups.slice(1)) {
    if (recallMatchConflictsWithTopPick(best, candidate)) {
      continue
    }
    pool.push(candidate)
    if (pool.length >= RECALL_RESULT_POOL_LIMIT) {
      break
    }
  }
  return pool
}

/** 由已折叠的互异组构建结果；池内全量交给 UI，首屏由 PAGE_SIZE 控制。 */
export function buildRecallResult(clue: string, collapsedGroups: RecallMatch[]): RecallResult {
  if (collapsedGroups.length === 0) {
    return emptyRecallResult(clue)
  }

  const best = collapsedGroups[0]
  if (!best) {
    return emptyRecallResult(clue)
  }

  // 有词面命中但未达 Top Pick：Need A Clue（弱候选池，请用户再补线索）
  if (best.score < RECALL_TOP_PICK_MIN_SCORE) {
    const pool = buildRankedRecallPool(collapsedGroups, { withTopConflictFilter: false })
    return {
      outcome: 'need_a_clue',
      topPick: null,
      alsoPossible: pool,
      totalRankedCount: pool.length,
      clue
    }
  }

  // 泛词 clue 不得仅凭出处页名（pageTitle）当 Top1，降级为弱候选追问
  if (recallTopPickBlockedByGenericPageTitleGate(clue, best.matchedFields)) {
    const pool = buildRankedRecallPool(collapsedGroups, { withTopConflictFilter: false })
    return {
      outcome: 'need_a_clue',
      topPick: null,
      alsoPossible: pool,
      totalRankedCount: pool.length,
      clue
    }
  }

  const pool = buildRankedRecallPool(collapsedGroups, { withTopConflictFilter: true })
  const head = pool[0] ?? best
  return {
    outcome: 'top_pick',
    topPick: head,
    alsoPossible: pool.slice(1),
    totalRankedCount: pool.length,
    clue
  }
}

/** 对 MemoryItem 列表执行关键词 Recall（含重复折叠与排序池）。 */
export function recallByKeyword(
  items: MemoryItem[],
  clue: string,
  options: { candidateLimit?: number; nowMs?: number } = {}
): RecallResult {
  const poolLimit = options.candidateLimit ?? RECALL_RESULT_POOL_LIMIT
  const matches = filterKeywordMatchesBeforeCollapse(items, clue, {
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs })
  })

  const collapsed = collapseRecallMatches(matches, {
    limit: poolLimit + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
  return buildRecallResult(clue, collapsed)
}
