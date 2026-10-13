import { describe, expect, it } from 'vitest'

import { shouldShowFirstRecallHint } from '@/core/recall/first-recall-onboarding'

describe('first-recall-onboarding', () => {
  it('未完成首次打开且在前几次存成时展示', () => {
    expect(shouldShowFirstRecallHint({ excerptCaptureCount: 1, firstRecallOpenDone: false })).toBe(
      true
    )
    expect(shouldShowFirstRecallHint({ excerptCaptureCount: 5, firstRecallOpenDone: false })).toBe(
      true
    )
  })

  it('已打开过结果或超出次数则不展示', () => {
    expect(shouldShowFirstRecallHint({ excerptCaptureCount: 1, firstRecallOpenDone: true })).toBe(
      false
    )
    expect(shouldShowFirstRecallHint({ excerptCaptureCount: 6, firstRecallOpenDone: false })).toBe(
      false
    )
    expect(shouldShowFirstRecallHint({ excerptCaptureCount: 0, firstRecallOpenDone: false })).toBe(
      false
    )
  })
})
