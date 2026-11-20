import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import {
  createDeviceToken,
  DEVICE_TOKEN_PREFIX,
  deviceTokenKvKey,
  getDeviceTokenRecord,
  getUserMeta,
  isDeviceTokenFormat,
  issueDeviceToken,
  revokeDeviceTokenSelf,
  userMetaKvKey
} from './device-token-kv'

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

function createEnv(kv = createKvMock()): Env {
  return {
    AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV']
  } as unknown as Env
}

describe('device token 生成与 KV', () => {
  test('格式为 ydt_ + 64 hex', () => {
    const token = createDeviceToken()
    expect(token.startsWith(DEVICE_TOKEN_PREFIX)).toBe(true)
    expect(isDeviceTokenFormat(token)).toBe(true)
    expect(token.length).toBe(4 + 64)
    expect(token.slice(4)).toMatch(/^[0-9a-f]{64}$/i)
  })

  test('issue + get + revoke', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const userId = '11111111-1111-1111-1111-111111111111'
    const issued = await issueDeviceToken(env, {
      userId,
      isAnonymous: false,
      email: 'a@example.com',
      deviceLabel: 'Test',
      platform: 'chrome'
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    expect(isDeviceTokenFormat(issued.deviceToken)).toBe(true)
    const record = await getDeviceTokenRecord(env, issued.deviceToken)
    expect(record?.userId).toBe(userId)
    expect(record?.deviceId).toBe(issued.deviceId)

    const meta = await getUserMeta(env, userId)
    expect(meta?.isAnonymous).toBe(false)
    expect(meta?.email).toBe('a@example.com')

    const revoked = await revokeDeviceTokenSelf(env, issued.deviceToken)
    expect(revoked.ok && revoked.revoked).toBe(true)
    expect(await getDeviceTokenRecord(env, issued.deviceToken)).toBeNull()
    expect(kv.store.has(deviceTokenKvKey(issued.deviceToken))).toBe(false)
  })

  test('第二次签发不覆盖已有 isAnonymous=false', async () => {
    const kv = createKvMock({
      [userMetaKvKey('u1')]: JSON.stringify({
        isAnonymous: false,
        email: 'kept@example.com',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    })
    const env = createEnv(kv)
    const issued = await issueDeviceToken(env, {
      userId: 'u1',
      isAnonymous: true,
      email: null
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    expect(issued.isAnonymous).toBe(false)
    const meta = await getUserMeta(env, 'u1')
    expect(meta?.isAnonymous).toBe(false)
    expect(meta?.email).toBe('kept@example.com')
  })
})
