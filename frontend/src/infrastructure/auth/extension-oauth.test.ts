import { describe, expect, it } from 'vitest'

import {
  mapSupabaseSessionToAuthSession,
  parseOAuthRedirectTokens
} from '@/infrastructure/auth/extension-oauth'

describe('parseOAuthRedirectTokens', () => {
  it('从 hash 解析 access_token / refresh_token', () => {
    const result = parseOAuthRedirectTokens(
      'https://abcdefgh.chromiumapp.org/#access_token=at&refresh_token=rt&token_type=bearer'
    )
    expect(result).toEqual({ accessToken: 'at', refreshToken: 'rt' })
  })

  it('从 query 解析（兼容）', () => {
    const result = parseOAuthRedirectTokens(
      'https://abcdefgh.chromiumapp.org/?access_token=at2&refresh_token=rt2'
    )
    expect(result).toEqual({ accessToken: 'at2', refreshToken: 'rt2' })
  })

  it('缺 token 返回 null', () => {
    expect(
      parseOAuthRedirectTokens('https://abcdefgh.chromiumapp.org/#error=access_denied')
    ).toBeNull()
  })
})

describe('mapSupabaseSessionToAuthSession', () => {
  const baseSession = {
    access_token: 'at',
    refresh_token: 'rt',
    expires_at: 1_700_000_000,
    user: {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'u@example.com',
      user_metadata: {} as Record<string, unknown>
    }
  }

  it('从 metadata 写入头像与展示名', () => {
    const mapped = mapSupabaseSessionToAuthSession({
      ...baseSession,
      user: {
        ...baseSession.user,
        user_metadata: {
          avatar_url: 'https://lh3.googleusercontent.com/a/xxx',
          name: '陈奇文'
        }
      }
    })
    expect(mapped.avatarUrl).toBe('https://lh3.googleusercontent.com/a/xxx')
    expect(mapped.displayName).toBe('陈奇文')
  })

  it('refresh 缺 metadata 时保留 previous 头像', () => {
    const mapped = mapSupabaseSessionToAuthSession(baseSession, {
      avatarUrl: 'https://example.com/kept.png',
      displayName: 'Kept'
    })
    expect(mapped.avatarUrl).toBe('https://example.com/kept.png')
    expect(mapped.displayName).toBe('Kept')
    expect(mapped.email).toBe('u@example.com')
  })
})
