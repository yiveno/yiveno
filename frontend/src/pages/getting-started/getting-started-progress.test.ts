import { describe, expect, it } from 'vitest'

import {
  deriveGettingStartedProgress,
  shouldRefreshGettingStartedProgress
} from '@/pages/getting-started/getting-started-progress'
import {
  EXCERPT_CAPTURE_COUNT_LOCAL_KEY,
  FIRST_RECALL_OPEN_DONE_LOCAL_KEY
} from '@/infrastructure/storage/first-recall-onboarding-storage'

describe('getting-started-progress', () => {
  it('deriveGettingStartedProgress 两步皆完成时 allDone', () => {
    expect(
      deriveGettingStartedProgress({ excerptCaptureCount: 2, firstRecallOpenDone: true })
    ).toEqual({
      captureDone: true,
      recallDone: true,
      allDone: true
    })
    expect(
      deriveGettingStartedProgress({ excerptCaptureCount: 0, firstRecallOpenDone: false })
    ).toEqual({
      captureDone: false,
      recallDone: false,
      allDone: false
    })
  })

  it('shouldRefreshGettingStartedProgress 仅关心 local 引导键', () => {
    expect(
      shouldRefreshGettingStartedProgress(
        { [EXCERPT_CAPTURE_COUNT_LOCAL_KEY]: { newValue: 1 } },
        'local'
      )
    ).toBe(true)
    expect(
      shouldRefreshGettingStartedProgress(
        { [FIRST_RECALL_OPEN_DONE_LOCAL_KEY]: { newValue: true } },
        'local'
      )
    ).toBe(true)
    expect(shouldRefreshGettingStartedProgress({}, 'session')).toBe(false)
    expect(shouldRefreshGettingStartedProgress({ foo: {} }, 'local')).toBe(false)
  })
})
