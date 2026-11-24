import { describe, expect, it } from 'bun:test'

import {
  AI_EXTRACT_FREE_DAILY_CAP,
  AI_EXTRACT_FREE_MONTHLY_QUOTA,
  AI_EXTRACT_PRO_DAILY_CAP,
  AI_EXTRACT_PRO_MONTHLY_QUOTA,
  commitExtractQuota,
  peekExtractQuota,
  type ExtractQuotaSnapshot
} from './extract-quota'
import type { Env } from '../../types/env'

function createKv(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    async get(key: string) {
      return store[key] ?? null
    },
    async put(key: string, value: string) {
      store[key] = value
    },
    store
  }
}

describe('extract-quota', () => {
  it('分档常量按决策锁定', () => {
    expect(AI_EXTRACT_FREE_DAILY_CAP).toBe(5)
    expect(AI_EXTRACT_FREE_MONTHLY_QUOTA).toBe(20)
    expect(AI_EXTRACT_PRO_DAILY_CAP).toBe(30)
    expect(AI_EXTRACT_PRO_MONTHLY_QUOTA).toBe(300)
  })

  it('超日盖 peek 拒绝；成功后 commit 才递增', async () => {
    const kv = createKv()
    const env = { AI_USAGE_KV: kv } as unknown as Env
    const userId = '22222222-2222-4222-8222-222222222222'

    const first = await peekExtractQuota(env, userId, false)
    expect(first.allowed).toBe(true)
    if (!first.allowed) {
      return
    }
    const after = await commitExtractQuota(env, first.snapshot)
    expect(after.dailyUsed).toBe(1)
    expect(after.used).toBe(1)

    const filled: ExtractQuotaSnapshot = {
      ...after,
      dailyUsed: AI_EXTRACT_FREE_DAILY_CAP,
      dailyRemaining: 0
    }
    await kv.put(filled.dayKey, String(AI_EXTRACT_FREE_DAILY_CAP))
    const blocked = await peekExtractQuota(env, userId, false)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed) {
      return
    }
    expect(blocked.reason).toBe('daily_cap_exceeded')
  })

  it('Pro 月盖高于 Free', async () => {
    const kv = createKv()
    const env = { AI_USAGE_KV: kv } as unknown as Env
    const userId = '33333333-3333-4333-8333-333333333333'
    const free = await peekExtractQuota(env, userId, false)
    const pro = await peekExtractQuota(env, userId, true)
    expect(free.allowed).toBe(true)
    expect(pro.allowed).toBe(true)
    if (!free.allowed || !pro.allowed) {
      return
    }
    expect(free.snapshot.limit).toBe(AI_EXTRACT_FREE_MONTHLY_QUOTA)
    expect(pro.snapshot.limit).toBe(AI_EXTRACT_PRO_MONTHLY_QUOTA)
    expect(pro.snapshot.dailyLimit).toBe(AI_EXTRACT_PRO_DAILY_CAP)
  })
})
