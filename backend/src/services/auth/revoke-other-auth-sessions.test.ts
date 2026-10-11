import { describe, expect, test } from 'bun:test'
import type { Env } from '../../types/env'
import { revokeOtherAuthSessions } from './revoke-other-auth-sessions'

function baseEnv(): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key'
  } as unknown as Env
}

describe('revokeOtherAuthSessions', () => {
  test('keep 为空 → 跳过不杀', async () => {
    const result = await revokeOtherAuthSessions(baseEnv(), 'u1', [])
    expect(result).toEqual({ ok: true, revokedCount: 0, listed: false })
  })

  test('列出后撤销非 keep 会话', async () => {
    const deletedIds: string[] = []
    const result = await revokeOtherAuthSessions(baseEnv(), 'u1', ['keep-web', 'keep-ext'], {
      listIds: async () => ['keep-web', 'keep-ext', 'old-a', 'old-web'],
      revokeById: async (_env, _userId, sessionId) => {
        deletedIds.push(sessionId)
        return true
      }
    })
    expect(result).toEqual({ ok: true, revokedCount: 2, listed: true })
    expect(deletedIds.sort()).toEqual(['old-a', 'old-web'])
  })

  test('列出失败 → list_failed', async () => {
    const result = await revokeOtherAuthSessions(baseEnv(), 'u1', ['keep-web'], {
      listIds: async () => null
    })
    expect(result).toEqual({ ok: false, reason: 'list_failed' })
  })
})
