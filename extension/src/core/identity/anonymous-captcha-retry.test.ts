import { describe, expect, it } from 'vitest'

import { shouldShowAnonymousCaptchaRetry } from '@/core/identity/anonymous-captcha-retry'

describe('shouldShowAnonymousCaptchaRetry', () => {
  it('仅 captcha 失败且未登录时出现', () => {
    expect(
      shouldShowAnonymousCaptchaRetry({
        signedIn: false,
        anonymousCaptchaRetryNeeded: true
      })
    ).toBe(true)
  })

  it('未失败不出现', () => {
    expect(
      shouldShowAnonymousCaptchaRetry({
        signedIn: false,
        anonymousCaptchaRetryNeeded: false
      })
    ).toBe(false)
  })

  it('正式账号已登录不出现', () => {
    expect(
      shouldShowAnonymousCaptchaRetry({
        signedIn: true,
        isAnonymous: false,
        anonymousCaptchaRetryNeeded: true
      })
    ).toBe(false)
  })

  it('匿名已登录且仍标需重试时出现', () => {
    expect(
      shouldShowAnonymousCaptchaRetry({
        signedIn: true,
        isAnonymous: true,
        anonymousCaptchaRetryNeeded: true
      })
    ).toBe(true)
  })
})
