import { describe, expect, it } from 'vitest'

import {
  compareMarkWithImplicitSettle,
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

  it('C1 medium 与 strong 始终可进 settled', () => {
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
        source: 'mark'
      })
    ).toBe(true)
  })

  it('getRecallOutcomeSettlePolicy 默认关 C2', () => {
    expect(getRecallOutcomeSettlePolicy().allowSettledLast).toBe(false)
  })
})

describe('compareMarkWithImplicitSettle', () => {
  it('Mark 与 C1 同 id → agrees true', () => {
    const result = compareMarkWithImplicitSettle({
      markedTargetId: 'only',
      opens: [{ id: 'only', at: '2026-08-24T00:00:00.000Z', dwellMs: 12_000 }]
    })
    expect(result.implicit.source).toBe('settled_single')
    expect(result.agrees).toBe(true)
  })

  it('Mark 与 C2 冲突 → agrees false', () => {
    const result = compareMarkWithImplicitSettle({
      markedTargetId: 'a',
      opens: [
        { id: 'a', at: '2026-08-24T00:00:00.000Z', dwellMs: 12_000 },
        { id: 'b', at: '2026-08-24T00:01:00.000Z', dwellMs: 15_000 }
      ]
    })
    expect(result.implicit.targetId).toBe('b')
    expect(result.agrees).toBe(false)
  })

  it('无 dwell 隐式 unknown → agrees null', () => {
    const result = compareMarkWithImplicitSettle({
      markedTargetId: 'a',
      opens: [
        { id: 'a', at: '2026-08-24T00:00:00.000Z' },
        { id: 'b', at: '2026-08-24T00:01:00.000Z' }
      ]
    })
    expect(result.agrees).toBeNull()
  })
})
