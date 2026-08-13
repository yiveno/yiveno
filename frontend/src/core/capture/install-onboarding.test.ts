import { describe, expect, it } from 'vitest'

import {
  shouldOpenGettingStartedOnInstall,
  shouldShowCaptureFirstPopup
} from '@/core/capture/install-onboarding'

describe('install-onboarding', () => {
  it('Capture-first：未完成引导且无摘录时展示', () => {
    expect(
      shouldShowCaptureFirstPopup({ excerptCaptureCount: 0, installOnboardingDone: false })
    ).toBe(true)
  })

  it('Capture-first：已有摘录或已完成引导时不展示', () => {
    expect(
      shouldShowCaptureFirstPopup({ excerptCaptureCount: 1, installOnboardingDone: false })
    ).toBe(false)
    expect(
      shouldShowCaptureFirstPopup({ excerptCaptureCount: 0, installOnboardingDone: true })
    ).toBe(false)
  })

  it('仅在 reason=install 时打开 Getting Started', () => {
    expect(shouldOpenGettingStartedOnInstall('install')).toBe(true)
    expect(shouldOpenGettingStartedOnInstall('update')).toBe(false)
    expect(shouldOpenGettingStartedOnInstall('chrome_update')).toBe(false)
  })
})
