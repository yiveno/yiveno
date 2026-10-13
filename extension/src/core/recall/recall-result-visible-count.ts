import {
  RECALL_RESULT_MAX_VISIBLE_DOM,
  RECALL_RESULT_PAGE_SIZE
} from '@/core/recall/build-recall-result'

/** 当前轮次允许挂载的最大卡数（不超过排序池 total）。 */
export function recallVisibleDomCap(total: number): number {
  return Math.min(Math.max(0, total), RECALL_RESULT_MAX_VISIBLE_DOM)
}

/** 计算 Show more 下一档可见条数。 */
export function resolveNextRecallVisibleCount(
  currentVisible: number,
  total: number,
  mode: 'page' | 'all'
): number {
  const cappedTotal = recallVisibleDomCap(total)
  if (mode === 'all') {
    return cappedTotal
  }
  return Math.min(cappedTotal, currentVisible + RECALL_RESULT_PAGE_SIZE)
}

/** 在 DOM 软顶内还可再展示几条。 */
export function recallRemainingVisibleCount(visible: number, total: number): number {
  return Math.max(0, recallVisibleDomCap(total) - visible)
}
