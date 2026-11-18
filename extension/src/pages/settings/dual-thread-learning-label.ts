import type { TranslateFn } from '@/core/i18n/translate'

/** 学习面板标签种类：结果 outcome / 确认 label / 失败 stage。 */
export type DualThreadLearningLabelKind = 'outcome' | 'confirm' | 'stage'

const OUTCOME_LABEL_KEYS = {
  top_pick: 'settings_dual_thread_learning_outcome_top_pick',
  need_a_clue: 'settings_dual_thread_learning_outcome_need_a_clue',
  no_match: 'settings_dual_thread_learning_outcome_no_match'
} as const

const CONFIRM_LABEL_KEYS = {
  target: 'settings_dual_thread_learning_confirm_target',
  none_in_results: 'settings_dual_thread_learning_confirm_none_in_results',
  absent: 'settings_dual_thread_learning_confirm_absent',
  unknown: 'settings_dual_thread_learning_confirm_unknown'
} as const

const STAGE_LABEL_KEYS = {
  not_captured: 'settings_dual_thread_learning_stage_not_captured',
  index_gap: 'settings_dual_thread_learning_stage_index_gap',
  candidate_miss: 'settings_dual_thread_learning_stage_candidate_miss',
  understand_skew: 'settings_dual_thread_learning_stage_understand_skew',
  rank_wrong: 'settings_dual_thread_learning_stage_rank_wrong',
  clue_insufficient: 'settings_dual_thread_learning_stage_clue_insufficient',
  absent_honest: 'settings_dual_thread_learning_stage_absent_honest',
  ux_friction: 'settings_dual_thread_learning_stage_ux_friction',
  unknown: 'settings_dual_thread_learning_stage_unknown'
} as const

const LABEL_TABLES: Record<DualThreadLearningLabelKind, Readonly<Record<string, string>>> = {
  outcome: OUTCOME_LABEL_KEYS,
  confirm: CONFIRM_LABEL_KEYS,
  stage: STAGE_LABEL_KEYS
}

/**
 * 将学习面板计数 key 解析为可读标签。
 * 未知 key 原样返回（fail-open，绝不隐藏数据）。
 */
export function resolveDualThreadLearningLabel(
  kind: DualThreadLearningLabelKind,
  key: string,
  t: TranslateFn
): string {
  const messageKey = LABEL_TABLES[kind][key]
  if (!messageKey) {
    return key
  }
  return t(messageKey)
}

/**
 * 学习面板耗时展示：null/undefined → em dash；数字带字面 `ms`。
 */
export function formatDualThreadLearningTimingMs(value: number | null | undefined): string {
  if (value == null) {
    return '—'
  }
  return `${value} ms`
}
