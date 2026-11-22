import { describe, expect, it } from 'vitest'

import type { BindOtpErrorKind } from '@/core/identity/bind-otp-flow'
import { BIND_OTP_ERROR_KEYS } from '@/pages/shared/bind-otp-error-copy'

/** 与状态机 kind 闭集对齐，防漏映射。 */
const ALL_KINDS: BindOtpErrorKind[] = [
  'rate_limited',
  'invalid_code',
  'too_many_attempts',
  'code_expired',
  'captcha',
  'captcha_not_configured',
  'email_conflict',
  'claim_user_not_found',
  'device_limit',
  'failed'
]

describe('bind-otp-error-copy', () => {
  it('每个 BindOtpErrorKind 都有 i18n key', () => {
    for (const kind of ALL_KINDS) {
      expect(BIND_OTP_ERROR_KEYS[kind]).toBeTruthy()
      expect(typeof BIND_OTP_ERROR_KEYS[kind]).toBe('string')
    }
    expect(Object.keys(BIND_OTP_ERROR_KEYS).sort()).toEqual([...ALL_KINDS].sort())
  })

  it('captcha_not_configured 映射独立 key（非 captcha）', () => {
    expect(BIND_OTP_ERROR_KEYS.captcha_not_configured).toBe(
      'settings_bind_error_captcha_not_configured'
    )
    expect(BIND_OTP_ERROR_KEYS.captcha).toBe('settings_bind_error_captcha')
    expect(BIND_OTP_ERROR_KEYS.captcha_not_configured).not.toBe(BIND_OTP_ERROR_KEYS.captcha)
  })
})
