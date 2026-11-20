import { describe, expect, it } from 'vitest'

import { isHostedQuotaSnapshot } from './hosted-quota-api-client'

describe('isHostedQuotaSnapshot', () => {
  const freeBase = {
    model: 'm',
    used: 1,
    limit: 60,
    remaining: 59,
    dailyUsed: 1,
    dailyLimit: 20,
    dailyRemaining: 19,
    monthKey: '2026-11'
  }

  it('放行 free / pro', () => {
    expect(isHostedQuotaSnapshot({ ...freeBase, tier: 'free' })).toBe(true)
    expect(isHostedQuotaSnapshot({ ...freeBase, tier: 'pro', limit: 600 })).toBe(true)
  })

  it('放行 anonymous（monthKey=lifetime + 可选 embed*）', () => {
    expect(
      isHostedQuotaSnapshot({
        model: 'm',
        tier: 'anonymous',
        used: 15,
        limit: 15,
        remaining: 0,
        dailyUsed: 15,
        dailyLimit: 15,
        dailyRemaining: 0,
        monthKey: 'lifetime',
        embedUsed: 3,
        embedLimit: 30,
        embedRemaining: 27
      })
    ).toBe(true)
  })

  it('anonymous 但 monthKey 非 lifetime → 拒绝', () => {
    expect(
      isHostedQuotaSnapshot({
        model: 'm',
        tier: 'anonymous',
        used: 1,
        limit: 15,
        remaining: 14,
        dailyUsed: 1,
        dailyLimit: 15,
        dailyRemaining: 14,
        monthKey: '2026-11'
      })
    ).toBe(false)
  })

  it('未知 tier → 拒绝（不误判为 free/pro）', () => {
    expect(isHostedQuotaSnapshot({ ...freeBase, tier: 'enterprise' })).toBe(false)
  })
})
