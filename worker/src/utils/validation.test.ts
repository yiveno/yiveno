import { describe, expect, test } from 'bun:test'
import type { Env } from '../types/env'
import { isAllowedRedirectUri } from './validation'

function envWithAllowlist(allowlist: string): Env {
  return { REDIRECT_URI_ALLOWLIST: allowlist } as Env
}

describe('isAllowedRedirectUri · HTTPS allowlist 精确匹配', () => {
  test('https://yiveno.com/callback 在 allowlist 含 https://yiveno.com 时放行', () => {
    const result = isAllowedRedirectUri(
      'https://yiveno.com/callback',
      envWithAllowlist('https://yiveno.com')
    )
    expect(result.ok).toBe(true)
  })

  test('https://yiveno.com.evil.com/callback 拒绝（禁止前缀偷渡）', () => {
    const result = isAllowedRedirectUri(
      'https://yiveno.com.evil.com/callback',
      envWithAllowlist('https://yiveno.com')
    )
    expect(result.ok).toBe(false)
    expect(result.error).toBe('redirect not in allowlist')
  })

  test('allowlist 不含 localhost 时 http://localhost:3001/callback 拒绝', () => {
    const result = isAllowedRedirectUri(
      'http://localhost:3001/callback',
      envWithAllowlist('https://yiveno.com')
    )
    expect(result.ok).toBe(false)
  })

  test('https://abc.chromiumapp.org/callback 放行（默认后缀）', () => {
    const result = isAllowedRedirectUri(
      'https://abc.chromiumapp.org/callback',
      envWithAllowlist('https://yiveno.com')
    )
    expect(result.ok).toBe(true)
  })
})
