import { describe, expect, it } from 'vitest'
import { isCompleteOtpCode, isValidEmail, normalizeEmail, normalizeOtpCode } from './auth-email'

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

  it('normalizeOtpCode 只留数字并截断', () => {
    expect(normalizeOtpCode('12-34 56')).toBe('123456')
    expect(normalizeOtpCode('1234567890')).toBe('12345678')
  })

  it('isCompleteOtpCode 6–8 位', () => {
    expect(isCompleteOtpCode('12345')).toBe(false)
    expect(isCompleteOtpCode('123456')).toBe(true)
    expect(isCompleteOtpCode('12 34 56')).toBe(true)
  })
})
