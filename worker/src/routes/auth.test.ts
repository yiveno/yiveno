import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'
import * as bindOtpService from '../services/auth/bind-otp-service'
import * as claimByOtpMod from '../services/auth/claim-by-otp'
import * as promoteMod from '../services/auth/promote-anonymous-user'
import { clearDeviceAuthCache } from '../middleware/device-auth'
import { issueDeviceToken } from '../services/auth/device-token-kv'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com'
} as Env

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = originalFetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  clearDeviceAuthCache()
})

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    }
  }
}

describe('auth routes', () => {
  test('POST /api/auth/promote 未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com' })
      },
      baseEnv
    )
    expect(response.status).toBe(401)
  })

  test('POST /api/auth/extension-session → 410 Gone（改走 device-register）', async () => {
    const app = createApp()
    const response = await app.request('/api/auth/extension-session', { method: 'POST' }, baseEnv)
    expect(response.status).toBe(410)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('gone')
  })

  test('POST /api/auth/extension-uninstall-revoke 缺 token → 400', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/extension-uninstall-revoke',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      },
      baseEnv
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('empty_token')
  })

  test('POST /api/auth/extension-uninstall-revoke 未知 token → 404', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/extension-uninstall-revoke',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'a'.repeat(64) })
      },
      {
        ...baseEnv,
        AI_USAGE_KV: {
          get: async () => null,
          put: async () => undefined,
          delete: async () => undefined
        }
      } as unknown as Env
    )
    expect(response.status).toBe(404)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_token')
  })

  test('遗留 OAuth 与 admin 端点已退役 → 404', async () => {
    const app = createApp()
    for (const path of [
      '/api/auth/providers',
      '/api/auth/start',
      '/api/auth/callback',
      '/api/admin/env/check'
    ]) {
      const response = await app.request(path, {}, baseEnv)
      expect(response.status).toBe(404)
    }
  })

  test('POST /api/auth/bind-code 未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-code',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', turnstileToken: 't' })
      },
      baseEnv
    )
    expect(response.status).toBe(401)
  })

  test('POST /api/auth/bind-verify 未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-verify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', code: '12345678' })
      },
      baseEnv
    )
    expect(response.status).toBe(401)
  })

  test('POST /api/auth/bind-code 非法 body → 透传 service 错误', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '11111111-1111-1111-1111-111111111111',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'requestBindCode').mockResolvedValue({
      ok: false,
      status: 400,
      error: 'invalid_email'
    })

    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-code',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'bad', turnstileToken: 't' })
      },
      env
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_email')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('POST /api/auth/bind-code 成功 → { success: true }', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '22222222-2222-2222-2222-222222222222',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'requestBindCode').mockResolvedValue({ ok: true })
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-code',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`,
          'CF-Connecting-IP': '203.0.113.1'
        },
        body: JSON.stringify({
          email: 'ok@example.com',
          turnstileToken: 'tok',
          locale: 'en'
        })
      },
      env
    )
    expect(response.status).toBe(200)
    const data = (await response.json()) as { success: boolean }
    expect(data.success).toBe(true)
    expect(spy.mock.calls[0]?.[1]).toMatchObject({
      email: 'ok@example.com',
      turnstileToken: 'tok',
      locale: 'en',
      ip: '203.0.113.1',
      userId: issued.userId,
      deviceId: issued.deviceId
    })
    spy.mockRestore()
  })

  test('POST /api/auth/bind-verify 成功 → branch + claimToken', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '33333333-3333-3333-3333-333333333333',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'verifyBindCode').mockResolvedValue({
      ok: true,
      data: { branch: 'promote', claimToken: 'd'.repeat(64) }
    })
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-verify',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'ok@example.com', code: '12345678' })
      },
      env
    )
    expect(response.status).toBe(200)
    const data = (await response.json()) as {
      success: boolean
      data: { branch: string; claimToken: string }
    }
    expect(data.success).toBe(true)
    expect(data.data.branch).toBe('promote')
    expect(data.data.claimToken).toBe('d'.repeat(64))
    spy.mockRestore()
  })

  test('POST /api/auth/bind-verify 主要失败路径 → invalid_code', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '44444444-4444-4444-4444-444444444444',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'verifyBindCode').mockResolvedValue({
      ok: false,
      status: 400,
      error: 'invalid_code',
      remainingAttempts: 3
    })
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-verify',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'ok@example.com', code: '00000000' })
      },
      env
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string; remainingAttempts?: number }
    expect(data.error).toBe('invalid_code')
    expect(data.remainingAttempts).toBe(3)
    spy.mockRestore()
  })

  test('POST /api/auth/promote 无 claimToken → 401 invalid_claim', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '55555555-5555-5555-5555-555555555555',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const app = createApp()
    const response = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'a@example.com' })
      },
      env
    )
    expect(response.status).toBe(401)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_claim')
  })

  test('POST /api/auth/promote 无效 token → 401', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '66666666-6666-6666-6666-666666666666',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const app = createApp()
    const response = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'a@example.com', claimToken: 'nope' })
      },
      env
    )
    expect(response.status).toBe(401)
    expect(((await response.json()) as { error: string }).error).toBe('invalid_claim')
  })

  test('POST /api/auth/promote 错 branch（claim token）→ 401', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const userId = '77777777-7777-7777-7777-777777777777'
    const issued = await issueDeviceToken(env, { userId, isAnonymous: true })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const token = 'p'.repeat(64)
    await bindOtpService.putClaimRecord(kv as never, token, {
      anonUserId: userId,
      email: 'a@example.com',
      branch: 'claim',
      targetUserId: 'tgt',
      createdAt: Date.now()
    })

    const app = createApp()
    const response = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'a@example.com', claimToken: token })
      },
      env
    )
    expect(response.status).toBe(401)
    expect(((await response.json()) as { error: string }).error).toBe('invalid_claim')
  })

  test('POST /api/auth/promote 有效 → 成功；重放 → 401', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const userId = '88888888-8888-8888-8888-888888888888'
    const issued = await issueDeviceToken(env, { userId, isAnonymous: true })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const token = 'q'.repeat(64)
    await bindOtpService.putClaimRecord(kv as never, token, {
      anonUserId: userId,
      email: 'ok@example.com',
      branch: 'promote',
      createdAt: Date.now()
    })

    const promoteSpy = spyOn(promoteMod, 'promoteAnonymousUser').mockResolvedValue({
      ok: true,
      data: { userId, email: 'ok@example.com', isAnonymous: false }
    })

    const app = createApp()
    const okRes = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'ok@example.com', claimToken: token })
      },
      env
    )
    expect(okRes.status).toBe(200)
    expect(((await okRes.json()) as { success: boolean }).success).toBe(true)
    expect(promoteSpy).toHaveBeenCalledTimes(1)

    const replay = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'ok@example.com', claimToken: token })
      },
      env
    )
    expect(replay.status).toBe(401)
    expect(((await replay.json()) as { error: string }).error).toBe('invalid_claim')
    promoteSpy.mockRestore()
  })

  test('POST /api/auth/promote 409 email_conflict 映射保留（token 已消费）', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const userId = '99999999-9999-9999-9999-999999999999'
    const issued = await issueDeviceToken(env, { userId, isAnonymous: true })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const token = 'r'.repeat(64)
    await bindOtpService.putClaimRecord(kv as never, token, {
      anonUserId: userId,
      email: 'taken@example.com',
      branch: 'promote',
      createdAt: Date.now()
    })

    const promoteSpy = spyOn(promoteMod, 'promoteAnonymousUser').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'email_conflict'
    })

    const app = createApp()
    const response = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'taken@example.com', claimToken: token })
      },
      env
    )
    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: string }).error).toBe('email_conflict')

    // 409 后同 token 重放 → 401（已消费）
    const replay = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'taken@example.com', claimToken: token })
      },
      env
    )
    expect(replay.status).toBe(401)
    promoteSpy.mockRestore()
  })

  test('POST /api/auth/claim-by-otp 未鉴权 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/claim-by-otp',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimToken: 'x' })
      },
      baseEnv
    )
    expect(response.status).toBe(401)
  })

  test('POST /api/auth/claim-by-otp 成功与失败路径', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const okSpy = spyOn(claimByOtpMod, 'claimByOtp').mockResolvedValue({
      ok: true,
      data: {
        deviceToken: 'ydt_' + '2'.repeat(64),
        deviceId: 'dev-claim',
        userId: 'target-user',
        email: 't@ex.com',
        displayName: null,
        avatarUrl: null,
        isAnonymous: false,
        uninstallRevokeToken: null
      }
    })

    const app = createApp()
    const okRes = await app.request(
      '/api/auth/claim-by-otp',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({
          claimToken: 's'.repeat(64),
          deviceLabel: 'Chrome',
          platform: 'macOS'
        })
      },
      env
    )
    expect(okRes.status).toBe(200)
    const okData = (await okRes.json()) as {
      success: boolean
      data: { deviceId: string; userId: string }
    }
    expect(okData.success).toBe(true)
    expect(okData.data.deviceId).toBe('dev-claim')
    expect(okSpy.mock.calls[0]?.[1]).toMatchObject({
      anonUserId: issued.userId,
      claimToken: 's'.repeat(64),
      deviceLabel: 'Chrome',
      platform: 'macOS'
    })
    okSpy.mockRestore()

    const failSpy = spyOn(claimByOtpMod, 'claimByOtp').mockResolvedValue({
      ok: false,
      status: 401,
      error: 'invalid_claim'
    })
    const failRes = await app.request(
      '/api/auth/claim-by-otp',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ claimToken: 'bad' })
      },
      env
    )
    expect(failRes.status).toBe(401)
    expect(((await failRes.json()) as { error: string }).error).toBe('invalid_claim')
    failSpy.mockRestore()
  })
})
