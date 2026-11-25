/**
 * 语音快捷键自动开新标签页的置信度门（纯函数）。
 * 只看本次 RecallResult；不读面板状态。
 */

import { RECALL_TOP_PICK_MIN_SCORE } from '@/core/recall/keyword-filter-weights'
import type { RecallResult } from '@/core/recall/recall-result'

/**
 * 头名相对第 2 名的最小分差（初值）。
 * 等于最小字段权重 url=10：top-1 至少多命中一个第 2 名完全没命中的字段级证据；
 * 分差不足时宁可开面板，不可猜着开。
 */
export const RECALL_AUTO_OPEN_MIN_GAP = 10

/**
 * 是否过自动打开门。
 * - 须 `top_pick` 且头名分 ≥ {@link RECALL_TOP_PICK_MIN_SCORE}
 * - alsoPossible 空 → 过门
 * - 否则头名 − 第 2 名 ≥ {@link RECALL_AUTO_OPEN_MIN_GAP}
 */
export function shouldAutoOpenRecallResult(result: RecallResult): boolean {
  if (result.outcome !== 'top_pick' || !result.topPick) {
    return false
  }
  if (result.topPick.score < RECALL_TOP_PICK_MIN_SCORE) {
    return false
  }
  const runnerUp = result.alsoPossible[0]
  if (!runnerUp) {
    return true
  }
  return result.topPick.score - runnerUp.score >= RECALL_AUTO_OPEN_MIN_GAP
}
