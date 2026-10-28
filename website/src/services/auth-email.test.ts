import { describe, expect, it } from 'vitest'
import {
  EMAIL_OTP_LENGTH,
  isCompleteOtpCode,
  isValidEmail,
  normalizeEmail,
  normalizeOtpCode
} from './auth-email'

describe('auth-email', () => {
  it('normalizeEmail 去空白并小写', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com')
    expect(normalizeEmail('')).toBe('')
  })

  it('isValidEmail 宽松形态', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('user.name+tag@mail.example.com')).toBe(true)
    expect(isValidEmail('no-at')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a @b.co')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('normalizeOtpCode 只留数字并截到 EMAIL_OTP_LENGTH', () => {
    expect(normalizeOtpCode('12-34 56')).toBe('123456')
    expect(normalizeOtpCode('1234567890')).toBe('12345678')
    expect(normalizeOtpCode('1234567890').length).toBe(EMAIL_OTP_LENGTH)
  })

  it('isCompleteOtpCode 精确 EMAIL_OTP_LENGTH 位（无区间）', () => {
    expect(EMAIL_OTP_LENGTH).toBe(8)
    expect(isCompleteOtpCode('1234567')).toBe(false)
    expect(isCompleteOtpCode('12345678')).toBe(true)
    expect(isCompleteOtpCode('12 34 56 78')).toBe(true)
    // 多粘贴：规范化截断后仍恰好满长 → 完整
    expect(isCompleteOtpCode('123456789')).toBe(true)
  })
})
