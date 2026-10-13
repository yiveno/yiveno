import { describe, expect, it } from 'vitest'

import { canSubmitGettingStartedRecall } from '@/pages/getting-started/getting-started-actions'

describe('getting-started-actions', () => {
  it('canSubmitGettingStartedRecall 需解锁、可召、非忙、有 clue', () => {
    expect(
      canSubmitGettingStartedRecall({
        recallBusy: false,
        canRecall: true,
        clue: 'that article',
        sourceUnlocked: true
      })
    ).toBe(true)
    expect(
      canSubmitGettingStartedRecall({
        recallBusy: false,
        canRecall: true,
        clue: 'that article',
        sourceUnlocked: false
      })
    ).toBe(false)
    expect(
      canSubmitGettingStartedRecall({
        recallBusy: true,
        canRecall: true,
        clue: 'that article',
        sourceUnlocked: true
      })
    ).toBe(false)
    expect(
      canSubmitGettingStartedRecall({
        recallBusy: false,
        canRecall: false,
        clue: 'that article',
        sourceUnlocked: true
      })
    ).toBe(false)
    expect(
      canSubmitGettingStartedRecall({
        recallBusy: false,
        canRecall: true,
        clue: '  ',
        sourceUnlocked: true
      })
    ).toBe(false)
  })
})
