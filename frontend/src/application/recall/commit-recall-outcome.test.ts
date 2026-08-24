import { describe, expect, it } from 'vitest'

import {
  shouldOfferRecallOutcomeExitPrompt,
  withFinalizedLastOpenDwell
} from '@/application/recall/commit-recall-outcome'

describe('shouldOfferRecallOutcomeExitPrompt', () => {
  const base = {
    markedTargetId: null as string | null,
    exitChoice: null as 'found' | 'none' | null,
    dismissedPending: false,
    sawNoMatchFinal: false,
    opens: [{ id: 'a' }]
  }

  it('有 open 且无强标签时出示', () => {
    expect(shouldOfferRecallOutcomeExitPrompt(base)).toBe(true)
  })

  it('已 Mark / dismiss / no_match / 出口选择时不出示', () => {
    expect(shouldOfferRecallOutcomeExitPrompt({ ...base, markedTargetId: 'a' })).toBe(false)
    expect(shouldOfferRecallOutcomeExitPrompt({ ...base, dismissedPending: true })).toBe(false)
    expect(shouldOfferRecallOutcomeExitPrompt({ ...base, sawNoMatchFinal: true })).toBe(false)
    expect(shouldOfferRecallOutcomeExitPrompt({ ...base, exitChoice: 'found' })).toBe(false)
  })

  it('无 open 不出示', () => {
    expect(shouldOfferRecallOutcomeExitPrompt({ ...base, opens: [] })).toBe(false)
  })
})

describe('withFinalizedLastOpenDwell', () => {
  it('给最后一次 open 补 dwell', () => {
    const opens = withFinalizedLastOpenDwell(
      [{ id: 'a', at: '2026-08-24T00:00:00.000Z' }],
      Date.parse('2026-08-24T00:00:12.000Z')
    )
    expect(opens[0]?.dwellMs).toBe(12_000)
  })

  it('已有 dwell 不覆盖', () => {
    const opens = withFinalizedLastOpenDwell(
      [{ id: 'a', at: '2026-08-24T00:00:00.000Z', dwellMs: 99 }],
      Date.parse('2026-08-24T00:00:12.000Z')
    )
    expect(opens[0]?.dwellMs).toBe(99)
  })
})
