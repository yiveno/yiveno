import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { decodeJwtForDiagnostics, verifySupabaseAccessToken } from './verify-supabase-access-token'
import * as supabaseJs from '@supabase/supabase-js'

/** 仅拼 JWT 三段结构（不依赖真实密钥）；中段为 payload JSON。 */
function encodeJwtPart(value: unknown): string {
  const json = typeof value === 'string' ? value : JSON.stringify(value)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildUnsignedJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>
): string {
  // 签名段占位，诊断解码不读签名
  return `${encodeJwtPart(header)}.${encodeJwtPart(payload)}.fakesig`
}

describe('decodeJwtForDiagnostics', () => {
  test('ES256 + kid → local_jwks，claims 摘要正确', () => {
    const token = buildUnsignedJwt(
      { alg: 'ES256', kid: 'test-kid-1', typ: 'JWT' },
      {
        sub: '63f46a67-9083-418e-a693-f576e47cc4a9',
        role: 'authenticated',
        aud: 'authenticated',
        iss: 'https://example.supabase.co/auth/v1',
        is_anonymous: true,
        exp: 1_700_000_000
      }
    )
    const decoded = decodeJwtForDiagnostics(token)
    expect(decoded).not.toBeNull()
    expect(decoded?.header).toEqual({ alg: 'ES256', kid: 'test-kid-1' })
    expect(decoded?.claims).toEqual({
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
      is_anonymous: true,
      exp: 1_700_000_000,
      subPrefix: '63f46a67'
    })
    expect(decoded?.verifyPath).toBe('local_jwks')
  })

  test('HS256 → auth_service_fallback', () => {
    const token = buildUnsignedJwt(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'anon', aud: 'authenticated' }
    )
    const decoded = decodeJwtForDiagnostics(token)
    expect(decoded?.verifyPath).toBe('auth_service_fallback')
    expect(decoded?.claims.role).toBe('anon')
    expect(decoded?.claims.subPrefix).toBe('aaaaaaaa')
  })
})

describe('verifySupabaseAccessToken', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>
  const prevLogOverride = process.env.WORKER_TEST_LOGS

  beforeEach(() => {
    process.env.WORKER_TEST_LOGS = '1'
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (prevLogOverride === undefined) {
      delete process.env.WORKER_TEST_LOGS
    } else {
      process.env.WORKER_TEST_LOGS = prevLogOverride
    }
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
        email: 'user@example.com',
        isAnonymous: false
      }
    })
  })

  test('getClaims 含 is_anonymous:true → isAnonymous true', async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: {
            claims: {
              sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              role: 'authenticated',
              aud: 'authenticated',
              is_anonymous: true
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
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        email: null,
        isAnonymous: true
      }
    })
  })

  test('未提供 anon key → auth_unreachable', async () => {
    const result = await verifySupabaseAccessToken('https://example.supabase.co', 'token')

    expect(result).toEqual({ ok: false, reason: 'auth_unreachable' })
  })

  test('getClaims 返回 error → invalid_token，并记 claims 诊断（不含 token 全文）', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600
    const token = buildUnsignedJwt(
      { alg: 'ES256', kid: 'diag-kid', typ: 'JWT' },
      {
        sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        role: 'service_role',
        aud: 'wrong-audience',
        iss: 'https://example.supabase.co/auth/v1',
        is_anonymous: false,
        exp: expiredAt
      }
    )

    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: null,
          error: {
            name: 'AuthApiError',
            message: 'Invalid JWT',
            code: 'invalid_jwt'
          }
        })
      }
    } as never)

    const result = await verifySupabaseAccessToken('https://example.supabase.co', token, {
      anonKey: 'anon-key'
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_token' })
    expect(warnSpy).toHaveBeenCalled()
    const logged = warnSpy.mock.calls.map(c => String(c[0])).join('\n')
    expect(logged).toContain('[VerifySupabase] getClaims 失败')
    expect(logged).toContain('service_role')
    expect(logged).toContain('wrong-audience')
    expect(logged).toContain('bbbbbbbb')
    expect(logged).toContain('local_jwks')
    expect(logged).toContain('AuthApiError')
    expect(logged).toContain('invalid_jwt')
    expect(logged).toContain(String(expiredAt))
    // 禁止泄漏 token 全文或签名段
    expect(logged).not.toContain(token)
    expect(logged).not.toContain('fakesig')
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

  test('AN3：匿名 claims 含 email:"" → ok，email null，isAnonymous true', async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: {
            claims: {
              sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              role: 'authenticated',
              aud: 'authenticated',
              is_anonymous: true,
              email: ''
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
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        email: null,
        isAnonymous: true
      }
    })
  })

  test('AN3：非匿名 claims 含 email:"" → ok，email null，isAnonymous false', async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: {
            claims: {
              sub: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
              role: 'authenticated',
              aud: 'authenticated',
              email: ''
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
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        email: null,
        isAnonymous: false
      }
    })
  })

  test('AN3：claims 缺 sub → malformed_response 并记诊断', async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: {
            claims: {
              role: 'authenticated',
              aud: 'authenticated',
              email: ''
            }
          },
          error: null
        })
      }
    } as never)

    const result = await verifySupabaseAccessToken('https://example.supabase.co', 'token', {
      anonKey: 'anon-key'
    })

    expect(result).toEqual({ ok: false, reason: 'malformed_response' })
    expect(warnSpy).toHaveBeenCalled()
    const logged = warnSpy.mock.calls.map(c => String(c[0])).join('\n')
    expect(logged).toContain('[VerifySupabase]')
    expect(logged).toContain('malformed_response')
  })

  test("AN3：role 'anon' → invalid_token 并记 role_rejected", async () => {
    jest.spyOn(supabaseJs, 'createClient').mockReturnValue({
      auth: {
        getClaims: async () => ({
          data: {
            claims: {
              sub: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              role: 'anon',
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

    expect(result).toEqual({ ok: false, reason: 'invalid_token' })
    expect(warnSpy).toHaveBeenCalled()
    const logged = warnSpy.mock.calls.map(c => String(c[0])).join('\n')
    expect(logged).toContain('[VerifySupabase]')
    expect(logged).toContain('role_rejected')
    expect(logged).toContain('anon')
  })
})
