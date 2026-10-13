import { afterEach, describe, expect, jest, test } from 'bun:test'
import { verifySupabaseAccessToken } from './verify-supabase-access-token'
import * as supabaseJs from '@supabase/supabase-js'

describe('verifySupabaseAccessToken', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('getClaims 成功 → ok', async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: {
            claims: {
              sub: '63f46a67-9083-418e-a693-f576e47cc4a9',
              email: 'user@example.com',
              role: 'authenticated',
              aud: 'authenticated'
            }
          },
          error: null
        })
      }
    } as never)

    const result = await verifySupabaseAccessToken('https://example.supabase.co', 'token', {
      anonKey: 'anon-key'
    })

    expect(result).toEqual({
      ok: true,
      user: {
        id: '63f46a67-9083-418e-a693-f576e47cc4a9',
        email: 'user@example.com'
      }
    })
  })

  test('未提供 anon key → auth_unreachable', async () => {
    const result = await verifySupabaseAccessToken('https://example.supabase.co', 'token')

    expect(result).toEqual({ ok: false, reason: 'auth_unreachable' })
  })

  test('getClaims 返回 error → invalid_token', async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: null,
          error: { message: 'Invalid JWT' }
        })
      }
    } as never)

    const result = await verifySupabaseAccessToken('https://example.supabase.co', 'bad-token', {
      anonKey: 'anon-key'
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_token' })
  })

  test('getClaims 抛异常 → auth_unreachable', async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => {
          throw new Error('network down')
        }
      }
    } as never)

    const result = await verifySupabaseAccessToken('https://example.supabase.co', 'token', {
      anonKey: 'anon-key'
    })

    expect(result).toEqual({ ok: false, reason: 'auth_unreachable' })
  })
})
