import { describe, expect, it } from 'vitest'

import {
  canSaveGettingStartedDemo,
  canTryGettingStartedRecall
} from '@/pages/getting-started/getting-started-actions'

describe('getting-started-actions', () => {
  it('canSaveGettingStartedDemo 保存中或已完成时不可再点', () => {
    expect(canSaveGettingStartedDemo({ saveState: 'idle', captureDone: false })).toBe(true)
    expect(canSaveGettingStartedDemo({ saveState: 'saving', captureDone: false })).toBe(false)
    expect(canSaveGettingStartedDemo({ saveState: 'idle', captureDone: true })).toBe(false)
  })

  it('canTryGettingStartedRecall 需已 Capture 且未完成 Recall', () => {
    expect(
      canTryGettingStartedRecall({ recallBusy: false, captureDone: true, recallDone: false })
    ).toBe(true)
    expect(
      canTryGettingStartedRecall({ recallBusy: true, captureDone: true, recallDone: false })
    ).toBe(false)
    expect(
      canTryGettingStartedRecall({ recallBusy: false, captureDone: false, recallDone: false })
    ).toBe(false)
    expect(
      canTryGettingStartedRecall({ recallBusy: false, captureDone: true, recallDone: true })
    ).toBe(false)
  })
})
