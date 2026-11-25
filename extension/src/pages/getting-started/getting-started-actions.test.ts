import { describe, expect, it, vi } from 'vitest'

import {
  canSubmitGettingStartedRecall,
  openGettingStartedRecallShell
} from '@/pages/getting-started/getting-started-actions'

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

  it('openGettingStartedRecallShell：先开火 openShell，再 markDone / 预填', async () => {
    const order: string[] = []
    const openShell = vi.fn(() => {
      order.push('open')
      return Promise.resolve()
    })
    const markDone = vi.fn(async () => {
      order.push('mark')
    })
    const writePrefill = vi.fn(async () => {
      order.push('prefill')
    })

    await openGettingStartedRecallShell({ openShell, markDone, writePrefill })

    expect(order).toEqual(['open', 'mark', 'prefill'])
    expect(openShell).toHaveBeenCalledTimes(1)
    expect(markDone).toHaveBeenCalledTimes(1)
    expect(writePrefill).toHaveBeenCalledTimes(1)
  })
})
