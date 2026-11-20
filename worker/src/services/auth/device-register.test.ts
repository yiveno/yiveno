import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import { handleDeviceRegister, type VerifyAccessTokenFn } from './device-register'
import { getUserDevicesIndex, getUserMeta, isDeviceTokenFormat } from './device-token-kv'

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

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    AI_USAGE_KV: createKvMock() as unknown as Env['AI_USAGE_KV'],
    ...overrides
  } as unknown as Env
}

function fakeVerify(
  userId: string,
  email: string | null,
  isAnonymous = false
): VerifyAccessTokenFn {
  return async () => ({ ok: true, user: { id: userId, email, isAnonymous } })
}

describe('handleDeviceRegister', () => {
  test('website_connect 发 token 不挤掉已有设备', async () => {
    const kv = createKvMock()
    const env = createEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] })
    const userId = '33333333-3333-3333-3333-333333333333'
    const verify = fakeVerify(userId, 'w@example.com', false)

    const first = await handleDeviceRegister(
      env,
      new Request('http://localhost/api/auth/device-register', {
        method: 'POST',
        headers: { authorization: 'Bearer supabase-access' }
      }),
      { mode: 'website_connect', deviceLabel: 'A' },
      { verifyAccessToken: verify }
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = await handleDeviceRegister(
      env,
      new Request('http://localhost/api/auth/device-register', {
        method: 'POST',
        headers: { authorization: 'Bearer supabase-access' }
      }),
      { mode: 'website_connect', deviceLabel: 'B' },
      { verifyAccessToken: verify }
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(isDeviceTokenFormat(second.data.deviceToken)).toBe(true)
    expect(second.data.deviceToken).not.toBe(first.data.deviceToken)

    const index = await getUserDevicesIndex(env, first.data.userId)
    expect(index.devices.length).toBe(2)
    const meta = await getUserMeta(env, first.data.userId)
    expect(meta?.isAnonymous).toBe(false)
  })

  test('session_exchange 发 token（非匿名；不撤销旧会话）', async () => {
    const result = await handleDeviceRegister(
      createEnv(),
      new Request('http://localhost/api/auth/device-register', {
        method: 'POST',
        headers: { authorization: 'Bearer old-access' }
      }),
      { mode: 'session_exchange' },
      {
        verifyAccessToken: fakeVerify(
          '44444444-4444-4444-4444-444444444444',
          'e@example.com',
          false
        )
      }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(isDeviceTokenFormat(result.data.deviceToken)).toBe(true)
    expect(result.data.isAnonymous).toBe(false)
  })

  test('session_exchange 匿名 JWT → isAnonymous true 且 user_meta 正确', async () => {
    const kv = createKvMock()
    const env = createEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] })
    const userId = '55555555-5555-5555-5555-555555555555'
    const result = await handleDeviceRegister(
      env,
      new Request('http://localhost/api/auth/device-register', {
        method: 'POST',
        headers: { authorization: 'Bearer anon-access' }
      }),
      { mode: 'session_exchange' },
      { verifyAccessToken: fakeVerify(userId, null, true) }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.isAnonymous).toBe(true)
    expect(result.data.email).toBeNull()
    expect(isDeviceTokenFormat(result.data.deviceToken)).toBe(true)
    expect(result.data.uninstallRevokeToken).toBeTruthy()
    const meta = await getUserMeta(env, userId)
    expect(meta?.isAnonymous).toBe(true)
  })
})
