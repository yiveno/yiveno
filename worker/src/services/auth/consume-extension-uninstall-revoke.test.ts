import { describe, expect, mock, test } from 'bun:test'
import type { Env } from '../../types/env'
import { extensionSessionLeaseKvKey } from './extension-session-lease-kv'
import { extensionUninstallRevokeKvKey } from './extension-uninstall-revoke-kv'

const userId = '11111111-1111-4111-8111-111111111111'
const sessionId = 'sess-abc'
const token = 'a'.repeat(64)

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
    const { consumeExtensionUninstallRevoke } = await import('./consume-extension-uninstall-revoke')
    const result = await consumeExtensionUninstallRevoke({} as Env, '  ')
    expect(result).toEqual({ ok: false, error: 'empty_token' })
  })

  test('未知 token → invalid_token', async () => {
    const { consumeExtensionUninstallRevoke } = await import('./consume-extension-uninstall-revoke')
    const env = { AI_USAGE_KV: createKv() } as unknown as Env
    const result = await consumeExtensionUninstallRevoke(env, token)
    expect(result).toEqual({ ok: false, error: 'invalid_token' })
  })

  test('有效 token → 撤 session、清租约、删 token', async () => {
    const store: Record<string, string> = {
      [extensionUninstallRevokeKvKey(token)]: JSON.stringify({
        userId,
        sessionId,
        extensionId: 'ext-a',
        createdAt: '2026-10-10T00:00:00.000Z'
      }),
      [extensionSessionLeaseKvKey(userId)]: JSON.stringify({
        sessionId,
        mintedAt: '2026-10-10T00:00:00.000Z',
        extensionId: 'ext-a',
        uninstallRevokeToken: token
      })
    }
    mock.module('./revoke-auth-session', () => ({
      revokeAuthSessionById: async () => true
    }))
    const { consumeExtensionUninstallRevoke } = await import('./consume-extension-uninstall-revoke')
    const result = await consumeExtensionUninstallRevoke(
      { AI_USAGE_KV: createKv(store) } as unknown as Env,
      token
    )
    expect(result).toEqual({ ok: true, revoked: true, clearedLease: true })
    expect(store[extensionUninstallRevokeKvKey(token)]).toBeUndefined()
    expect(store[extensionSessionLeaseKvKey(userId)]).toBeUndefined()
  })
})
