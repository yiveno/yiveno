import { describe, expect, mock, test } from 'bun:test'
import type { Env } from '../../types/env'

function fakeAccessToken(sessionId: string, userId = 'u1'): string {
  const payload = btoa(JSON.stringify({ sub: userId, session_id: sessionId }))
  return `hdr.${payload}.sig`
}

function baseEnv(store: Record<string, string>): Env {
  return {
    AI_USAGE_KV: {
      get: async (key: string) => store[key] ?? null,
      put: async (key: string, value: string) => {
        store[key] = value
      },
      delete: async (key: string) => {
        delete store[key]
      }
    }
  } as unknown as Env
}

describe('probeExtensionSessionLease', () => {
  test('租约匹配 → active', async () => {
    mock.restore()
    const store: Record<string, string> = {
      'ext_auth_session:u1': JSON.stringify({
        sessionId: 'sess-a',
        mintedAt: '2026-10-01T00:00:00.000Z',
        extensionId: 'ext'
      })
    }
    const { probeExtensionSessionLease } = await import('./probe-extension-session-lease')
    const result = await probeExtensionSessionLease(baseEnv(store), 'u1', fakeAccessToken('sess-a'))
    expect(result).toEqual({ status: 'active' })
  })

  test('租约是另一条 session → displaced', async () => {
    mock.restore()
    const store: Record<string, string> = {
      'ext_auth_session:u1': JSON.stringify({
        sessionId: 'sess-b',
        mintedAt: '2026-10-01T00:00:00.000Z',
        extensionId: 'ext'
      })
    }
    const { probeExtensionSessionLease } = await import('./probe-extension-session-lease')
    const result = await probeExtensionSessionLease(baseEnv(store), 'u1', fakeAccessToken('sess-a'))
    expect(result).toEqual({ status: 'displaced' })
  })

  test('无租约 → active（降级）', async () => {
    mock.restore()
    const { probeExtensionSessionLease } = await import('./probe-extension-session-lease')
    const result = await probeExtensionSessionLease(baseEnv({}), 'u1', fakeAccessToken('sess-a'))
    expect(result).toEqual({ status: 'active' })
  })

  test('token 无 session_id → unknown', async () => {
    mock.restore()
    const payload = btoa(JSON.stringify({ sub: 'u1' }))
    const { probeExtensionSessionLease } = await import('./probe-extension-session-lease')
    const result = await probeExtensionSessionLease(baseEnv({}), 'u1', `hdr.${payload}.sig`)
    expect(result).toEqual({ status: 'unknown' })
  })
})
