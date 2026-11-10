import { describe, expect, it } from 'bun:test'

import {
  AI_DREAMING_FREE_DAILY_CAP,
  AI_DREAMING_FREE_MONTHLY_QUOTA,
  AI_DREAMING_PRO_DAILY_CAP,
  AI_DREAMING_PRO_MONTHLY_QUOTA,
  commitDreamingQuota,
  peekDreamingQuota,
  type DreamingQuotaSnapshot
} from './dreaming-quota'
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

describe('dreaming-quota', () => {
  it('分档常量按决策锁定', () => {
    expect(AI_DREAMING_FREE_DAILY_CAP).toBe(5)
    expect(AI_DREAMING_FREE_MONTHLY_QUOTA).toBe(20)
    expect(AI_DREAMING_PRO_DAILY_CAP).toBe(30)
    expect(AI_DREAMING_PRO_MONTHLY_QUOTA).toBe(300)
  })

  it('超日盖 peek 拒绝；成功后 commit 才递增', async () => {
    const kv = createKv()
    const env = { AI_USAGE_KV: kv } as unknown as Env
    const userId = '11111111-1111-4111-8111-111111111111'

    const first = await peekDreamingQuota(env, userId, false)
    expect(first.allowed).toBe(true)
    if (!first.allowed) {
      return
    }
    const after = await commitDreamingQuota(env, first.snapshot)
    expect(after.dailyUsed).toBe(1)
    expect(after.used).toBe(1)

    // 灌满日盖
    const filled: DreamingQuotaSnapshot = {
      ...after,
      dailyUsed: AI_DREAMING_FREE_DAILY_CAP,
      dailyRemaining: 0
    }
    await kv.put(filled.dayKey, String(AI_DREAMING_FREE_DAILY_CAP))
    const blocked = await peekDreamingQuota(env, userId, false)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed) {
      return
    }
    expect(blocked.reason).toBe('daily_cap_exceeded')
  })
})
