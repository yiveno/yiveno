import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dismissVoiceFeedbackBanner,
  isVoiceFeedbackBannerMounted,
  showVoiceFeedbackBanner,
  VOICE_FEEDBACK_AUTO_DISMISS_MS,
  VOICE_FEEDBACK_HOST_ID
} from '@/content/selection-toolbar/voice-feedback-banner'

describe('voice-feedback-banner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dismissVoiceFeedbackBanner()
    document.getElementById(VOICE_FEEDBACK_HOST_ID)?.remove()
  })

  afterEach(() => {
    dismissVoiceFeedbackBanner()
    vi.useRealTimers()
  })

  it('渲染横幅并在自动时长后消失', () => {
    showVoiceFeedbackBanner({
      message: 'No strong match',
      dismissLabel: 'Dismiss',
      title: 'Yiveno'
    })

    expect(isVoiceFeedbackBannerMounted()).toBe(true)
    const host = document.getElementById(VOICE_FEEDBACK_HOST_ID)
    expect(host).toBeTruthy()
    expect(host?.style.pointerEvents).toBe('none')
    const banner = host?.shadowRoot?.querySelector('.banner') as HTMLElement | null
    expect(banner?.style.pointerEvents).toBe('auto')
    expect(banner?.textContent).toContain('No strong match')

    vi.advanceTimersByTime(VOICE_FEEDBACK_AUTO_DISMISS_MS - 1)
    expect(isVoiceFeedbackBannerMounted()).toBe(true)

    vi.advanceTimersByTime(1)
    expect(isVoiceFeedbackBannerMounted()).toBe(false)
    expect(document.getElementById(VOICE_FEEDBACK_HOST_ID)).toBeNull()
  })

  it('重复触发只留一条横幅', () => {
    showVoiceFeedbackBanner({ message: 'first', dismissLabel: 'Dismiss' })
    showVoiceFeedbackBanner({ message: 'second', dismissLabel: 'Dismiss' })

    const hosts = document.querySelectorAll(`#${VOICE_FEEDBACK_HOST_ID}`)
    expect(hosts.length).toBe(1)
    const message = hosts[0]?.shadowRoot?.querySelector('.banner__message')?.textContent
    expect(message).toBe('second')
  })

  it('点关闭立刻拆除', () => {
    showVoiceFeedbackBanner({ message: 'unclear', dismissLabel: 'Dismiss' })
    const host = document.getElementById(VOICE_FEEDBACK_HOST_ID)
    const dismissBtn = host?.shadowRoot?.querySelector(
      '.banner__dismiss'
    ) as HTMLButtonElement | null
    expect(dismissBtn).toBeTruthy()
    dismissBtn?.click()
    expect(isVoiceFeedbackBannerMounted()).toBe(false)
  })
})
