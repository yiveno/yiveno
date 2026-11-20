import { describe, expect, test } from 'bun:test'
import type { Env } from '../../types/env'
import { deviceTokenKvKey, userDevicesKvKey } from './device-token-kv'
import { extensionUninstallRevokeKvKey } from './extension-uninstall-revoke-kv'
import { consumeExtensionUninstallRevoke } from './consume-extension-uninstall-revoke'

const userId = '11111111-1111-4111-8111-111111111111'
const deviceId = '22222222-2222-4222-8222-222222222222'
const deviceToken = `ydt_${'a'.repeat(64)}`
const token = 'b'.repeat(64)

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

describe('consumeExtensionUninstallRevoke', () => {
  test('空 token → empty_token', async () => {
    const result = await consumeExtensionUninstallRevoke({} as Env, '  ')
    expect(result).toEqual({ ok: false, error: 'empty_token' })
  })

  test('未知 token → invalid_token', async () => {
    const env = { AI_USAGE_KV: createKv() } as unknown as Env
    const result = await consumeExtensionUninstallRevoke(env, token)
    expect(result).toEqual({ ok: false, error: 'invalid_token' })
  })

  test('有效 token → 撤 device、删卸载票', async () => {
    const store: Record<string, string> = {
      [extensionUninstallRevokeKvKey(token)]: JSON.stringify({
        userId,
        deviceId,
        extensionId: 'ext-a',
        createdAt: '2026-10-10T00:00:00.000Z'
      }),
      [deviceTokenKvKey(deviceToken)]: JSON.stringify({
        deviceId,
        userId,
        createdAt: '2026-10-10T00:00:00.000Z',
        lastSeenAt: '2026-10-10T00:00:00.000Z',
        deviceLabel: 'Chrome',
        platform: 'macOS',
        isAnonymousAtIssue: false
      }),
      [userDevicesKvKey(userId)]: JSON.stringify({
        devices: [
          {
            deviceId,
            deviceLabel: 'Chrome',
            platform: 'macOS',
            createdAt: '2026-10-10T00:00:00.000Z',
            lastSeenAt: '2026-10-10T00:00:00.000Z',
            tokenKeySuffix: deviceToken.slice(-8),
            deviceToken
          }
        ]
      })
    }
    const result = await consumeExtensionUninstallRevoke(
      { AI_USAGE_KV: createKv(store) } as unknown as Env,
      token
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.revoked).toBe(true)
    expect(result.deviceToken).toBe(deviceToken)
    expect(store[extensionUninstallRevokeKvKey(token)]).toBeUndefined()
    expect(store[deviceTokenKvKey(deviceToken)]).toBeUndefined()
  })
})
