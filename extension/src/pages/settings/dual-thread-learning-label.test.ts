import { describe, expect, it } from 'vitest'

import {
  formatDualThreadLearningTimingMs,
  resolveDualThreadLearningLabel
} from '@/pages/settings/dual-thread-learning-label'

/** stub：直接回传 key，便于断言映射表。 */
const stubT = (key: string): string => key

describe('resolveDualThreadLearningLabel', () => {
  it('outcome 三个已知 key 映射到对应 i18n key', () => {
    expect(resolveDualThreadLearningLabel('outcome', 'top_pick', stubT)).toBe(
      'settings_dual_thread_learning_outcome_top_pick'
    )
    expect(resolveDualThreadLearningLabel('outcome', 'need_a_clue', stubT)).toBe(
      'settings_dual_thread_learning_outcome_need_a_clue'
    )
    expect(resolveDualThreadLearningLabel('outcome', 'no_match', stubT)).toBe(
      'settings_dual_thread_learning_outcome_no_match'
    )
  })

  it('confirm 四个已知 key 映射到对应 i18n key', () => {
    expect(resolveDualThreadLearningLabel('confirm', 'target', stubT)).toBe(
      'settings_dual_thread_learning_confirm_target'
    )
    expect(resolveDualThreadLearningLabel('confirm', 'none_in_results', stubT)).toBe(
      'settings_dual_thread_learning_confirm_none_in_results'
    )
    expect(resolveDualThreadLearningLabel('confirm', 'absent', stubT)).toBe(
      'settings_dual_thread_learning_confirm_absent'
    )
    expect(resolveDualThreadLearningLabel('confirm', 'unknown', stubT)).toBe(
      'settings_dual_thread_learning_confirm_unknown'
    )
  })

  it('stage 九个已知 key 映射到对应 i18n key', () => {
    const stages = [
      'not_captured',
      'index_gap',
      'candidate_miss',
      'understand_skew',
      'rank_wrong',
      'clue_insufficient',
      'absent_honest',
      'ux_friction',
      'unknown'
    ] as const
    for (const stage of stages) {
      expect(resolveDualThreadLearningLabel('stage', stage, stubT)).toBe(
        `settings_dual_thread_learning_stage_${stage}`
      )
    }
  })

  it('未知 key 原样返回（fail-open）', () => {
    expect(resolveDualThreadLearningLabel('outcome', 'weird_outcome', stubT)).toBe('weird_outcome')
    expect(resolveDualThreadLearningLabel('confirm', 'weird_confirm', stubT)).toBe('weird_confirm')
    expect(resolveDualThreadLearningLabel('stage', 'weird_stage', stubT)).toBe('weird_stage')
  })
})

describe('formatDualThreadLearningTimingMs', () => {
  it('null / undefined → em dash', () => {
    expect(formatDualThreadLearningTimingMs(null)).toBe('—')
    expect(formatDualThreadLearningTimingMs(undefined)).toBe('—')
  })

  it('数字 → 带 ms 字面单位', () => {
    expect(formatDualThreadLearningTimingMs(0)).toBe('0 ms')
    expect(formatDualThreadLearningTimingMs(128)).toBe('128 ms')
  })
})
