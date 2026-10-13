/**
 * §7.2 P2：Outcome 隐式标签校准策略。
 * 未过 gold 门前 C2（settled_last / medium_low）不得写入 settledCount / often_opened。
 */

import { type ResolvedRecallOutcome } from '@/core/recall/recall-outcome'

/** 默认 dwell 阈值（ms）。种子 study 可改；改前须记入校准旁挂。 */
export const RECALL_OUTCOME_DWELL_THRESHOLD_MS = 10_000

/**
 * C2 是否允许写入 settled 正例。
 * Normative：默认 false；仅当相对 gold / 出口 Found 的 False target 过门后改为 true。
 * @see docs/engineering/R4-Outcome-Labeling-P2-校准.md
 */
export const RECALL_OUTCOME_C2_SETTLE_ENABLED = false

/** settled 写入策略（供 commit / 单测注入）。 */
export interface RecallOutcomeSettlePolicy {
  /** 是否允许 C2 medium_low 进 settledCount */
  allowSettledLast: boolean
  /** dwell 阈值 ms */
  dwellThresholdMs: number
}

/** 当前进程默认策略（未校准：C2 关闭）。 */
export function getRecallOutcomeSettlePolicy(): RecallOutcomeSettlePolicy {
  return {
    allowSettledLast: RECALL_OUTCOME_C2_SETTLE_ENABLED,
    dwellThresholdMs: RECALL_OUTCOME_DWELL_THRESHOLD_MS
  }
}

/**
 * 是否可作为 often_opened / settled 正例写入条目。
 * strong / medium / medium_high 始终可写；medium_low（C2）仅策略允许时。
 */
export function recallOutcomeCountsAsSettled(
  resolved: ResolvedRecallOutcome,
  policy: RecallOutcomeSettlePolicy = getRecallOutcomeSettlePolicy()
): boolean {
  if (resolved.label !== 'target' || !resolved.targetId) {
    return false
  }
  if (
    resolved.confidence === 'strong' ||
    resolved.confidence === 'medium' ||
    resolved.confidence === 'medium_high'
  ) {
    return true
  }
  if (resolved.confidence === 'medium_low') {
    return policy.allowSettledLast
  }
  return false
}
