/**
 * 配额豁免白名单：名单内照常计数，永不因配额被拒；KV 未配置仍拒绝。
 */

import { describe, expect, test } from 'bun:test'

import { buildDailyUsageKey, buildMonthlyUsageKey } from '../../config/ai-hosted'
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

function createEnv(
  kv: ReturnType<typeof createKvMock> | undefined,
  overrides: Record<string, unknown> = {}
): Env {
  return {
    ...(kv ? { AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] } : {}),
    ...overrides
  } as unknown as Env
}

describe('配额豁免白名单', () => {
  test('豁免账号月配额已满仍 allowed，计数 +1，limit=MAX_SAFE_INTEGER', async () => {
    const userId = 'exempt-user'
    const monthKey = buildMonthlyUsageKey(userId)
    const dayKey = buildDailyUsageKey(userId)
    const kv = createKvMock({ [monthKey]: '60', [dayKey]: '0' })
    const env = createEnv(kv, {
      AI_HOSTED_FREE_MONTHLY_QUOTA: '60',
      AI_HOSTED_FREE_DAILY_CAP: '10',
      AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'exempt-user'
    })

    const snap = await getHostedQuotaSnapshot(env, userId, false)
    expect(snap.used).toBe(60)
    expect(snap.limit).toBe(Number.MAX_SAFE_INTEGER)
    expect(snap.dailyLimit).toBe(Number.MAX_SAFE_INTEGER)
    expect(snap.remaining).toBe(Number.MAX_SAFE_INTEGER - 60)
    expect(snap.tier).toBe('free')

    const ok = await consumeHostedQuota(env, userId, false)
    expect(ok.allowed).toBe(true)
    if (!ok.allowed) return
    expect(ok.snapshot.used).toBe(61)
    expect(ok.snapshot.dailyUsed).toBe(1)
    expect(ok.snapshot.limit).toBe(Number.MAX_SAFE_INTEGER)
    expect(ok.snapshot.dailyLimit).toBe(Number.MAX_SAFE_INTEGER)
    expect(kv.store.get(monthKey)).toBe('61')
  })

  test('豁免账号日盖已满仍 allowed，计数 +1', async () => {
    const userId = 'exempt-user'
    const monthKey = buildMonthlyUsageKey(userId)
    const dayKey = buildDailyUsageKey(userId)
    const kv = createKvMock({ [monthKey]: '5', [dayKey]: '10' })
    const env = createEnv(kv, {
      AI_HOSTED_FREE_MONTHLY_QUOTA: '60',
      AI_HOSTED_FREE_DAILY_CAP: '10',
      AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'exempt-user'
    })

    const ok = await consumeHostedQuota(env, userId, false)
    expect(ok.allowed).toBe(true)
    if (!ok.allowed) return
    expect(ok.snapshot.used).toBe(6)
    expect(ok.snapshot.dailyUsed).toBe(11)
    expect(kv.store.get(dayKey)).toBe('11')
  })

  test('非豁免账号月配额已满 → quota_exceeded', async () => {
    const userId = 'normal-user'
    const monthKey = buildMonthlyUsageKey(userId)
    const kv = createKvMock({ [monthKey]: '60' })
    const env = createEnv(kv, {
      AI_HOSTED_FREE_MONTHLY_QUOTA: '60',
      AI_HOSTED_FREE_DAILY_CAP: '10',
      AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'exempt-user'
    })

    const denied = await consumeHostedQuota(env, userId, false)
    expect(denied.allowed).toBe(false)
    if (denied.allowed) return
    expect(denied.reason).toBe('quota_exceeded')
    expect(denied.snapshot.used).toBe(60)
    expect(denied.snapshot.limit).toBe(60)
  })

  test('非豁免账号日盖已满 → daily_cap_exceeded', async () => {
    const userId = 'normal-user'
    const monthKey = buildMonthlyUsageKey(userId)
    const dayKey = buildDailyUsageKey(userId)
    const kv = createKvMock({ [monthKey]: '5', [dayKey]: '10' })
    const env = createEnv(kv, {
      AI_HOSTED_FREE_MONTHLY_QUOTA: '60',
      AI_HOSTED_FREE_DAILY_CAP: '10',
      AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'exempt-user'
    })

    const denied = await consumeHostedQuota(env, userId, false)
    expect(denied.allowed).toBe(false)
    if (denied.allowed) return
    expect(denied.reason).toBe('daily_cap_exceeded')
    expect(denied.snapshot.dailyUsed).toBe(10)
    expect(denied.snapshot.dailyLimit).toBe(10)
  })

  test('豁免账号 KV 未配置仍 kv_not_configured', async () => {
    const env = createEnv(undefined, {
      AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'exempt-user'
    })

    const denied = await consumeHostedQuota(env, 'exempt-user', false)
    expect(denied.allowed).toBe(false)
    if (denied.allowed) return
    expect(denied.reason).toBe('kv_not_configured')
  })
})
