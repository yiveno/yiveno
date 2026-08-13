import { describe, expect, test } from 'bun:test'

import type { PaddleSubscriptionSnapshot } from './paddle-client'
import {
  extractYivenoUserId,
  isPaddleAccessActive,
  mapPaddleStatus,
  snapshotToSubscriptionRecord
} from './normalize'

const USER_ID = '11111111-1111-4111-8111-111111111111'

function snapshot(overrides: Partial<PaddleSubscriptionSnapshot> = {}): PaddleSubscriptionSnapshot {
  return {
    id: 'sub_01h1vjes1y163hjs1s211srxny',
    status: 'active',
    customerId: 'ctm_01abc',
    priceId: 'pri_01abc',
    transactionId: 'txn_01abc',
    customUserId: USER_ID,
    currentPeriodStart: '2026-08-01T00:00:00.000Z',
    currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    scheduledChangeEffectiveAt: null,
    ...overrides
  }
}

describe('mapPaddleStatus', () => {
  test('trialing / active → active', () => {
    expect(mapPaddleStatus('trialing')).toBe('active')
    expect(mapPaddleStatus('active')).toBe('active')
  })

  test('canceled → cancelled；past_due / paused 原样映射', () => {
    expect(mapPaddleStatus('canceled')).toBe('cancelled')
    expect(mapPaddleStatus('past_due')).toBe('past_due')
    expect(mapPaddleStatus('paused')).toBe('paused')
  })
})

describe('isPaddleAccessActive', () => {
  test('仅 active 授 Pro；past_due 不授', () => {
    expect(isPaddleAccessActive('active')).toBe(true)
    expect(isPaddleAccessActive('past_due')).toBe(false)
    expect(isPaddleAccessActive('cancelled')).toBe(false)
  })
})

describe('extractYivenoUserId', () => {
  test('合法 UUID 才接受', () => {
    expect(extractYivenoUserId({ yiveno_user_id: USER_ID })).toBe(USER_ID)
    expect(extractYivenoUserId({ yiveno_user_id: 'not-a-uuid' })).toBeNull()
    expect(extractYivenoUserId(null)).toBeNull()
  })
})

describe('snapshotToSubscriptionRecord', () => {
  test('周期结束取消：仍 active + cancel_at_period_end', () => {
    const record = snapshotToSubscriptionRecord(
      snapshot({ cancelAtPeriodEnd: true, scheduledChangeEffectiveAt: '2026-09-01T00:00:00.000Z' }),
      USER_ID,
      'paddle_webhook'
    )
    expect(record.status).toBe('active')
    expect(record.cancel_at_period_end).toBe(true)
    expect(record.tier).toBe('pro')
  })
})
