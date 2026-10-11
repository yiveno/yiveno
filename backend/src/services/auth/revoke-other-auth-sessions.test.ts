import { afterEach, describe, expect, test } from 'bun:test'
import type { Env } from '../../types/env'
import { revokeOtherAuthSessions } from './revoke-other-auth-sessions'

function baseEnv(): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key'
  } as unknown as Env
}

describe('revokeOtherAuthSessions', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('keep 为空 → 跳过不杀', async () => {
    const result = await revokeOtherAuthSessions(baseEnv(), 'u1', [])
    expect(result).toEqual({ ok: true, revokedCount: 0, listed: false })
  })

  test('列出后撤销非 keep 会话', async () => {
    const deletedIds: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method || 'GET').toUpperCase()
      if (method === 'GET' && url.includes('/rest/v1/sessions')) {
        return new Response(
          JSON.stringify([
            { id: 'keep-web' },
            { id: 'keep-ext' },
            { id: 'old-a' },
            { id: 'old-web' }
          ]),
          { status: 200 }
        )
      }
      if (method === 'DELETE') {
        const adminMatch = url.match(/\/sessions\/([^/?]+)/)
        if (adminMatch?.[1]) {
          deletedIds.push(decodeURIComponent(adminMatch[1]))
        }
        return new Response(null, { status: 204 })
      }
      return new Response('{}', { status: 500 })
    }) as typeof fetch

    const result = await revokeOtherAuthSessions(baseEnv(), 'u1', ['keep-web', 'keep-ext'])
    expect(result).toEqual({ ok: true, revokedCount: 2, listed: true })
    expect(deletedIds.sort()).toEqual(['old-a', 'old-web'])
  })
})
