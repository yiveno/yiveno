import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import {
  createDeviceToken,
  DEVICE_CAP_PER_USER,
  DEVICE_TOKEN_PREFIX,
  deviceTokenKvKey,
  getDeviceTokenRecord,
  getUserMeta,
  isDeviceTokenFormat,
  issueDeviceToken,
  listDevicesForUser,
  renameDeviceById,
  revokeDeviceById,
  revokeDeviceTokenSelf,
  userDevicesKvKey,
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

  test('listDevicesForUser 过滤索引漂移 id', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const liveToken = `ydt_${'c'.repeat(64)}`
    const liveId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const driftId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const kv = createKvMock({
      [deviceTokenKvKey(liveToken)]: JSON.stringify({
        deviceId: liveId,
        userId,
        createdAt: '2026-01-01T00:00:00.000Z',
        lastSeenAt: '2026-01-02T00:00:00.000Z',
        deviceLabel: 'Live',
        platform: 'macOS',
        isAnonymousAtIssue: false
      }),
      [userDevicesKvKey(userId)]: JSON.stringify({
        devices: [
          {
            deviceId: liveId,
            deviceLabel: 'Live',
            platform: 'macOS',
            createdAt: '2026-01-01T00:00:00.000Z',
            lastSeenAt: '2026-01-02T00:00:00.000Z',
            tokenKeySuffix: liveToken.slice(-8),
            deviceToken: liveToken
          },
          {
            deviceId: driftId,
            deviceLabel: 'Ghost',
            platform: 'macOS',
            createdAt: '2026-01-01T00:00:00.000Z',
            lastSeenAt: '2026-01-01T00:00:00.000Z',
            tokenKeySuffix: 'deadbeef',
            deviceToken: `ydt_${'d'.repeat(64)}`
          }
        ]
      })
    })
    const listed = await listDevicesForUser(createEnv(kv), userId)
    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.devices).toHaveLength(1)
    expect(listed.devices[0]?.deviceId).toBe(liveId)
  })

  test('revokeDeviceById 他人设备 → not_found', async () => {
    const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const env = createEnv()
    const issued = await issueDeviceToken(env, {
      userId: owner,
      isAnonymous: false,
      deviceLabel: 'Mine'
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const result = await revokeDeviceById(env, other, issued.deviceId)
    expect(
      result.ok && !result.revoked && 'reason' in result && result.reason === 'not_found'
    ).toBe(true)
    expect(await getDeviceTokenRecord(env, issued.deviceToken)).not.toBeNull()
  })

  test('renameDeviceById 空名 → invalid_name；合法改名成功', async () => {
    const env = createEnv()
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const issued = await issueDeviceToken(env, {
      userId,
      isAnonymous: false,
      deviceLabel: 'Old'
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const bad = await renameDeviceById(env, userId, issued.deviceId, '   ')
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.error).toBe('invalid_name')

    const ok = await renameDeviceById(env, userId, issued.deviceId, '  New Name  ')
    expect(ok.ok).toBe(true)
    if (!ok.ok || !('device' in ok)) return
    expect(ok.device.name).toBe('New Name')
    const record = await getDeviceTokenRecord(env, issued.deviceToken)
    expect(record?.deviceLabel).toBe('New Name')
  })

  test('设备 cap 超限 → device_limit_reached', async () => {
    const env = createEnv()
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    for (let i = 0; i < DEVICE_CAP_PER_USER; i++) {
      const issued = await issueDeviceToken(env, {
        userId,
        isAnonymous: false,
        deviceLabel: `D${i}`
      })
      expect(issued.ok).toBe(true)
    }
    const over = await issueDeviceToken(env, {
      userId,
      isAnonymous: false,
      deviceLabel: 'over'
    })
    expect(over.ok).toBe(false)
    if (over.ok) return
    expect(over.error).toBe('device_limit_reached')
  })
})
