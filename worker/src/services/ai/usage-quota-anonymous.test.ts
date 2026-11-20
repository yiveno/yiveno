import { describe, expect, test } from 'bun:test'

import { buildLifetimeUsageKey } from '../../config/ai-hosted'
import type { Env } from '../../types/env'
import { consumeHostedQuota, getHostedQuotaSnapshot } from './usage-quota'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    }
  }
}

function createEnv(kv = createKvMock(), overrides: Record<string, unknown> = {}): Env {
  return {
    AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
    ...overrides
  } as unknown as Env
}

describe('匿名终身配额', () => {
  test('第 15 次放行、第 16 次 429；monthKey=lifetime；daily* 镜像', async () => {
    const userId = 'anon-user-1'
    const kv = createKvMock({ [buildLifetimeUsageKey(userId)]: '14' })
    const env = createEnv(kv, { AI_HOSTED_ANONYMOUS_LIFETIME_QUOTA: '15' })

    const ok = await consumeHostedQuota(env, userId, { isAnonymous: true, isPro: true })
    expect(ok.allowed).toBe(true)
    if (!ok.allowed) return
    expect(ok.snapshot.used).toBe(15)
    expect(ok.snapshot.tier).toBe('anonymous')
    expect(ok.snapshot.monthKey).toBe('lifetime')
    expect(ok.snapshot.dailyUsed).toBe(15)
    expect(ok.snapshot.dailyLimit).toBe(15)

    const denied = await consumeHostedQuota(env, userId, { isAnonymous: true, isPro: true })
    expect(denied.allowed).toBe(false)
    if (denied.allowed) return
    expect(denied.reason).toBe('quota_exceeded')
    expect(denied.snapshot.tier).toBe('anonymous')
    expect(denied.snapshot.used).toBe(15)
  })

  test('月配额 key 不影响终身档；isAnonymous 优先于 isPro', async () => {
    const userId = 'anon-user-2'
    const monthKey = `ai_usage:${userId}:2099-01`
    const kv = createKvMock({ [monthKey]: '999' })
    const env = createEnv(kv, { AI_HOSTED_ANONYMOUS_LIFETIME_QUOTA: '15' })

    const snap = await getHostedQuotaSnapshot(env, userId, { isAnonymous: true, isPro: true })
    expect(snap.tier).toBe('anonymous')
    expect(snap.used).toBe(0)
    expect(snap.monthKey).toBe('lifetime')
    expect(snap.limit).toBe(15)
  })
})
