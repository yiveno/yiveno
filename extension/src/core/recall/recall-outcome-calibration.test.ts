import { describe, expect, it } from 'vitest'

import {
  getRecallOutcomeSettlePolicy,
  recallOutcomeCountsAsSettled,
  RECALL_OUTCOME_C2_SETTLE_ENABLED
} from '@/core/recall/recall-outcome-calibration'
import { resolveRecallOutcome } from '@/core/recall/recall-outcome'

describe('recallOutcomeCountsAsSettled（P2 校准门）', () => {
  it('默认策略下 C2 medium_low 不进 settled', () => {
    expect(RECALL_OUTCOME_C2_SETTLE_ENABLED).toBe(false)
    const c2 = resolveRecallOutcome({
      sessionStopped: true,
      opens: [
        { id: 'a', at: '2026-08-24T00:00:00.000Z', dwellMs: 12_000 },
        { id: 'b', at: '2026-08-24T00:01:00.000Z', dwellMs: 15_000 }
      ]
    })
    expect(c2.source).toBe('settled_last')
    expect(recallOutcomeCountsAsSettled(c2)).toBe(false)
    expect(
      recallOutcomeCountsAsSettled(c2, {
        allowSettledLast: true,
        dwellThresholdMs: 10_000
      })
    ).toBe(true)
  })

  it('C1 medium 与出口 strong 始终可进 settled', () => {
    const c1 = resolveRecallOutcome({
      sessionStopped: true,
      opens: [{ id: 'only', at: '2026-08-24T00:00:00.000Z', dwellMs: 12_000 }]
    })
    expect(recallOutcomeCountsAsSettled(c1)).toBe(true)
    expect(
      recallOutcomeCountsAsSettled({
        label: 'target',
        targetId: 'm',
        confidence: 'strong',
        source: 'exit_prompt'
      })
    ).toBe(true)
  })

  it('getRecallOutcomeSettlePolicy 默认关 C2', () => {
    expect(getRecallOutcomeSettlePolicy().allowSettledLast).toBe(false)
  })
})
