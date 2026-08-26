import { describe, expect, it } from 'vitest'

import { buildRecallOutcomeEvent, resolveRecallOutcome } from '@/core/recall/recall-outcome'
import { recallOutcomeCountsAsSettled } from '@/core/recall/recall-outcome-calibration'

describe('resolveRecallOutcome', () => {
  it('出口 Found 优先于 dismiss / no_match', () => {
    const resolved = resolveRecallOutcome({
      exitChoice: 'found',
      exitFoundId: 'a',
      dismissedPending: true,
      sawNoMatchFinal: true
    })
    expect(resolved).toEqual({
      label: 'target',
      targetId: 'a',
      confidence: 'strong',
      source: 'exit_prompt'
    })
  })

  it('出口 Found / None', () => {
    expect(
      resolveRecallOutcome({
        exitChoice: 'found',
        exitFoundId: 'b',
        dismissedPending: true
      })
    ).toMatchObject({ label: 'target', targetId: 'b', source: 'exit_prompt' })

    expect(resolveRecallOutcome({ exitChoice: 'none' })).toEqual({
      label: 'none_in_results',
      confidence: 'strong',
      source: 'exit_prompt'
    })
  })

  it('dismiss → none_in_results；no_match → absent', () => {
    expect(resolveRecallOutcome({ dismissedPending: true })).toEqual({
      label: 'none_in_results',
      confidence: 'strong',
      source: 'dismiss'
    })
    expect(resolveRecallOutcome({ sawNoMatchFinal: true })).toEqual({
      label: 'absent',
      confidence: 'strong',
      source: 'no_match'
    })
  })

  it('禁止仅用 last-open 当 target（无 dwell）', () => {
    const resolved = resolveRecallOutcome({
      sessionStopped: true,
      opens: [
        { id: 'a', at: '2026-08-24T00:00:00.000Z' },
        { id: 'b', at: '2026-08-24T00:01:00.000Z' }
      ]
    })
    expect(resolved.label).toBe('unknown')
  })

  it('C1：单开 + dwell + stop → medium target', () => {
    const resolved = resolveRecallOutcome({
      sessionStopped: true,
      opens: [{ id: 'only', at: '2026-08-24T00:00:00.000Z', dwellMs: 12_000 }]
    })
    expect(resolved).toEqual({
      label: 'target',
      targetId: 'only',
      confidence: 'medium',
      source: 'settled_single'
    })
    expect(recallOutcomeCountsAsSettled(resolved)).toBe(true)
  })

  it('C2：多开 + 最后 dwell + stop → medium_low；medium_low 暂不进 settled 正例', () => {
    const resolved = resolveRecallOutcome({
      sessionStopped: true,
      opens: [
        { id: 'a', at: '2026-08-24T00:00:00.000Z', dwellMs: 12_000 },
        { id: 'b', at: '2026-08-24T00:01:00.000Z', dwellMs: 15_000 }
      ]
    })
    expect(resolved).toEqual({
      label: 'target',
      targetId: 'b',
      confidence: 'medium_low',
      source: 'settled_last'
    })
    expect(recallOutcomeCountsAsSettled(resolved)).toBe(false)
  })

  it('C5 copy 在无 C1 时生效', () => {
    const resolved = resolveRecallOutcome({
      sessionStopped: true,
      opens: [
        { id: 'a', at: '2026-08-24T00:00:00.000Z' },
        { id: 'b', at: '2026-08-24T00:01:00.000Z' }
      ],
      copiedOrPackedId: 'pack-1'
    })
    expect(resolved).toMatchObject({
      label: 'target',
      targetId: 'pack-1',
      confidence: 'medium_high',
      source: 'copy'
    })
  })

  it('buildRecallOutcomeEvent 组装字段', () => {
    const event = buildRecallOutcomeEvent({
      sessionId: 's1',
      effectiveClue: 'peck fable',
      resultIds: ['a', 'b'],
      opens: [],
      resolved: {
        label: 'none_in_results',
        confidence: 'strong',
        source: 'dismiss'
      },
      resolvedAt: '2026-08-24T06:00:00.000Z'
    })
    expect(event.label).toBe('none_in_results')
    expect(event.source).toBe('dismiss')
    expect(event.sessionId).toBe('s1')
  })
})
