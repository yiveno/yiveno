import { describe, expect, mock, test } from 'bun:test'
import type { Env } from '../../types/env'
import { extensionSessionLeaseKvKey } from './extension-session-lease-kv'
import { extensionUninstallRevokeKvKey } from './extension-uninstall-revoke-kv'

const userId = 'u1'
const revokeToken = 'r'.repeat(64)

function fakeAccessToken(sessionId: string, uid = userId): string {
  const payload = btoa(JSON.stringify({ sub: uid, session_id: sessionId }))
  return `hdr.${payload}.sig`
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

function baseEnv(store: Record<string, string>): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    AI_USAGE_KV: createKv(store)
  } as unknown as Env
}

describe('releaseExtensionSessionByAccessToken', () => {
  test('租约匹配：撤 session + 清租约 + 丢弃 revoke token', async () => {
    const store: Record<string, string> = {
      [extensionSessionLeaseKvKey(userId)]: JSON.stringify({
        sessionId: 'sess-a',
        mintedAt: '2026-01-01T00:00:00.000Z',
        uninstallRevokeToken: revokeToken
      }),
      [extensionUninstallRevokeKvKey(revokeToken)]: JSON.stringify({
        userId,
        sessionId: 'sess-a',
        extensionId: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      })
    }
    mock.module('./revoke-auth-session', () => ({
      revokeAuthSessionById: async () => true
    }))
    const { releaseExtensionSessionByAccessToken } = await import('./release-extension-session')
    const result = await releaseExtensionSessionByAccessToken(
      baseEnv(store),
      userId,
      fakeAccessToken('sess-a')
    )
    expect(result).toEqual({ ok: true, revoked: true, clearedLease: true })
    expect(store[extensionSessionLeaseKvKey(userId)]).toBeUndefined()
    expect(store[extensionUninstallRevokeKvKey(revokeToken)]).toBeUndefined()
  })

  test('租约已被他端占用：只撤本会话，不清租约', async () => {
    const store: Record<string, string> = {
      [extensionSessionLeaseKvKey(userId)]: JSON.stringify({
        sessionId: 'sess-other',
        mintedAt: '2026-01-01T00:00:00.000Z'
      })
    }
    mock.module('./revoke-auth-session', () => ({
      revokeAuthSessionById: async () => true
    }))
    const { releaseExtensionSessionByAccessToken } = await import('./release-extension-session')
    const result = await releaseExtensionSessionByAccessToken(
      baseEnv(store),
      userId,
      fakeAccessToken('sess-a')
    )
    expect(result).toEqual({ ok: true, revoked: true, clearedLease: false })
    expect(store[extensionSessionLeaseKvKey(userId)]).toContain('sess-other')
  })

  test('无 session_id → no_session_id', async () => {
    const payload = btoa(JSON.stringify({ sub: userId }))
    const { releaseExtensionSessionByAccessToken } = await import('./release-extension-session')
    const result = await releaseExtensionSessionByAccessToken(
      baseEnv({}),
      userId,
      `hdr.${payload}.sig`
    )
    expect(result).toEqual({ ok: false, error: 'no_session_id' })
  })
})
