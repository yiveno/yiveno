import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  clearOtpResendCooldown,
  markOtpResendCooldown,
  OTP_RESEND_COOLDOWN_SEC,
  peekOtpResendCooldown,
  remainingOtpResendSecFor
} from './otp-resend-cooldown'

describe('otp-resend-cooldown', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
  })

  test('mark 后同邮箱可读剩余秒；不同邮箱为 0', () => {
    markOtpResendCooldown('CQW@Example.COM', 60)
    expect(remainingOtpResendSecFor('cqw@example.com')).toBe(60)
    expect(remainingOtpResendSecFor('other@example.com')).toBe(0)
    const peek = peekOtpResendCooldown()
    expect(peek).toEqual({ email: 'cqw@example.com', remainingSec: 60 })
  })

  test('时间流逝后剩余减少；过期清键', () => {
    markOtpResendCooldown('a@b.co', OTP_RESEND_COOLDOWN_SEC)
    vi.advanceTimersByTime(15_000)
    expect(remainingOtpResendSecFor('a@b.co')).toBe(45)
    vi.advanceTimersByTime(50_000)
    expect(remainingOtpResendSecFor('a@b.co')).toBe(0)
    expect(peekOtpResendCooldown()).toBeNull()
  })

  test('clear 立刻清零', () => {
    markOtpResendCooldown('a@b.co')
    clearOtpResendCooldown()
    expect(remainingOtpResendSecFor('a@b.co')).toBe(0)
  })
})
