import { describe, expect, test, jest, afterEach } from 'bun:test'

import { toSubscriptionStatusPayload, handleGetSubscriptionStatus } from './subscription'
import type { Subscription } from '@yiveno/types'

const baseSub: Subscription = {
  user_id: '11111111-1111-4111-8111-111111111111',
  status: 'active',
  tier: 'pro',
  current_period_start: '2026-08-01T00:00:00.000Z',
  current_period_end: '2026-09-01T00:00:00.000Z',
  cancel_at_period_end: false
}

describe('toSubscriptionStatusPayload', () => {
  test('无订阅 → free', () => {
    expect(toSubscriptionStatusPayload(null, false)).toEqual({
      isPro: false,
      tier: 'free',
      status: 'inactive',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false
    })
  })

  test('active pro → isPro true', () => {
    expect(toSubscriptionStatusPayload(baseSub, true)).toMatchObject({
      isPro: true,
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: baseSub.current_period_end
    })
  })
})

describe('handleGetSubscriptionStatus', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('聚合 getUserSubscription + isActiveProUser', async () => {
    const supabase = await import('../data-access/supabase')
    const requirePro = await import('../services/ai/require-pro-user')
    jest.spyOn(supabase, 'getUserSubscription').mockResolvedValue(baseSub)
    jest.spyOn(requirePro, 'isActiveProUser').mockResolvedValue(true)

    const result = await handleGetSubscriptionStatus({} as never, baseSub.user_id)
    expect(result.isPro).toBe(true)
    expect(result.tier).toBe('pro')
  })
})
