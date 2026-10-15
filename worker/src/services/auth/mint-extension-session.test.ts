import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Env } from '../../types/env'

const userId = '11111111-1111-4111-8111-111111111111'

/** 含 session_id claim 的假 JWT（payload 仅供 readJwtSessionId） */
function fakeAccessToken(sessionId: string): string {
  const header = btoa(JSON.stringify({ alg: 'none' }))
  const payload = btoa(JSON.stringify({ sub: userId, session_id: sessionId }))
  return `${header}.${payload}.sig`
}

function createKv(store: Record<string, string> = {}) {
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string) => {
      store[key] = value
    },
    delete: async (key: string) => {
      delete store[key]
    }
  }
}

function baseEnv(kv: ReturnType<typeof createKv>): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    AI_USAGE_KV: kv
  } as unknown as Env
}

function mockMintSuccess(access: string, revokeOk = true): void {
  mock.module('../../data-access/supabase', () => ({
    createSupabaseClient: () => ({
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: null }, error: null }),
          generateLink: async () => ({
            data: {
              user: { id: userId },
              properties: { hashed_token: 'hash-token' }
            },
            error: null
          })
        }
      }
    })
  }))
  mock.module('@supabase/supabase-js', () => ({
    createClient: () => ({
      auth: {
        verifyOtp: async () => ({
          data: {
            session: {
              access_token: access,
              refresh_token: 'ext-refresh',
              expires_at: 1700000000,
              user: { id: userId, email: 'a@example.com' }
            }
          },
          error: null
        })
      }
    })
  }))
  mock.module('./revoke-auth-session', () => ({
    revokeAuthSessionById: async () => revokeOk
  }))
  mock.module('./auth-session-exists', () => ({
    authSessionExistsById: async () => ({ status: 'alive' as const })
  }))
}

function mockLeaseLiveness(status: 'alive' | 'gone' | 'unknown'): void {
  mock.module('./auth-session-exists', () => ({
    authSessionExistsById: async () => ({ status })
  }))
}

afterEach(() => {
  mock.restore()
})

describe('mintExtensionSession', () => {
  test('配置缺失时返回 supabase_not_configured', async () => {
    const { mintExtensionSession } = await import('./mint-extension-session')
    const result = await mintExtensionSession({} as Env, userId, 'a@example.com')
    expect(result).toEqual({ ok: false, error: 'supabase_not_configured' })
  })

  test('无 extensionId 的旧租约 → 清除后放行铸造', async () => {
    const store: Record<string, string> = {
      [`ext_auth_session:${userId}`]: JSON.stringify({
        sessionId: 'old-session',
        mintedAt: '2026-10-01T00:00:00.000Z'
      })
    }
    const access = fakeAccessToken('new-session')
    mockMintSuccess(access)
    const { mintExtensionSession } = await import('./mint-extension-session')
    const result = await mintExtensionSession(baseEnv(createKv(store)), userId, 'a@example.com', {
      extensionId: 'ext-a'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.sessionId).toBe('new-session')
    expect(result.session.uninstallRevokeToken).toBeTruthy()
    expect(store[`ext_auth_session:${userId}`]).toContain('ext-a')
    expect(store[`ext_auth_session:${userId}`]).toContain('uninstallRevokeToken')
  })

  test('已有存活租约 → 未确认时一律 needs_displace_confirm（与 extensionId 无关）', async () => {
    const store: Record<string, string> = {
      [`ext_auth_session:${userId}`]: JSON.stringify({
        sessionId: 'old-session',
        mintedAt: '2026-10-01T00:00:00.000Z',
        extensionId: 'ext-a'
      })
    }
    mock.module('../../data-access/supabase', () => ({
      createSupabaseClient: () => ({ auth: { admin: {} } })
    }))
    mockLeaseLiveness('alive')
    const { mintExtensionSession } = await import('./mint-extension-session')
    // CWS 场景：家里与上班 extensionId 相同，仍须确认
    const result = await mintExtensionSession(baseEnv(createKv(store)), userId, 'a@example.com', {
      extensionId: 'ext-a'
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('needs_displace_confirm')
    expect(result.existingSessionId).toBe('old-session')
    expect(store[`ext_auth_session:${userId}`]).toContain('old-session')
  })

  test('已有租约但 Auth session 已不存在 → 清僵死租约后直接铸造', async () => {
    const store: Record<string, string> = {
      [`ext_auth_session:${userId}`]: JSON.stringify({
        sessionId: 'zombie-session',
        mintedAt: '2026-10-01T00:00:00.000Z',
        extensionId: 'ext-a'
      })
    }
    const access = fakeAccessToken('new-session')
    mockMintSuccess(access)
    mockLeaseLiveness('gone')
    const { mintExtensionSession } = await import('./mint-extension-session')
    const result = await mintExtensionSession(baseEnv(createKv(store)), userId, 'a@example.com', {
      extensionId: 'ext-a'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.sessionId).toBe('new-session')
    expect(result.displacedSessionId).toBeNull()
    expect(store[`ext_auth_session:${userId}`]).toContain('new-session')
  })

  test('租约存活探测 unknown → 仍 needs_displace_confirm（保守）', async () => {
    const store: Record<string, string> = {
      [`ext_auth_session:${userId}`]: JSON.stringify({
        sessionId: 'old-session',
        mintedAt: '2026-10-01T00:00:00.000Z',
        extensionId: 'ext-a'
      })
    }
    mock.module('../../data-access/supabase', () => ({
      createSupabaseClient: () => ({ auth: { admin: {} } })
    }))
    mockLeaseLiveness('unknown')
    const { mintExtensionSession } = await import('./mint-extension-session')
    const result = await mintExtensionSession(baseEnv(createKv(store)), userId, 'a@example.com', {
      extensionId: 'ext-a'
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('needs_displace_confirm')
  })

  test('已有租约 + confirmDisplace → 铸造并挤掉旧扩展 session', async () => {
    const store: Record<string, string> = {
      [`ext_auth_session:${userId}`]: JSON.stringify({
        sessionId: 'old-session',
        mintedAt: '2026-10-01T00:00:00.000Z',
        extensionId: 'ext-a'
      })
    }
    const access = fakeAccessToken('new-session')
    mockMintSuccess(access)
    const { mintExtensionSession } = await import('./mint-extension-session')
    const result = await mintExtensionSession(baseEnv(createKv(store)), userId, 'a@example.com', {
      extensionId: 'ext-a',
      confirmDisplace: true
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.displacedSessionId).toBe('old-session')
    expect(result.session.sessionId).toBe('new-session')
  })

  test('confirmDisplace 时 Auth 撤销失败 → 中止铸造（不写新租约）', async () => {
    const store: Record<string, string> = {
      [`ext_auth_session:${userId}`]: JSON.stringify({
        sessionId: 'old-session',
        mintedAt: '2026-10-01T00:00:00.000Z',
        extensionId: 'ext-a'
      })
    }
    const access = fakeAccessToken('new-session')
    mockMintSuccess(access, false)
    const { mintExtensionSession } = await import('./mint-extension-session')
    const result = await mintExtensionSession(baseEnv(createKv(store)), userId, 'a@example.com', {
      extensionId: 'ext-a',
      confirmDisplace: true
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('displace_revoke_failed')
    expect(store[`ext_auth_session:${userId}`]).toContain('old-session')
  })
})
