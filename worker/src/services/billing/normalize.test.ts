import { describe, expect, test } from 'bun:test'

import type { DodoSubscriptionSnapshot } from './dodo-client'
import {
  extractYivenoUserId,
  isDodoAccessActive,
  mapDodoStatus,
  snapshotToSubscriptionRecord
} from './normalize'

const USER_ID = '11111111-1111-4111-8111-111111111111'

function snapshot(overrides: Partial<DodoSubscriptionSnapshot> = {}): DodoSubscriptionSnapshot {
  return {
    id: 'sub_Iuaq622bbmmfOGrVTqdXv',
    status: 'active',
    customerId: 'cus_TV52uJWWXt2yIoBBxpjaa',
    productId: 'pdt_pro_monthly',
    paymentId: 'pay_gr4RizvMOXFJ6xca3y2tU',
    customUserId: USER_ID,
    currentPeriodStart: '2026-08-01T00:00:00.000Z',
    currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    ...overrides
  }
}

describe('mapDodoStatus', () => {
  test('active → active；Dodo past_due（宽限）→ active；on_hold → 本地 past_due', () => {
    expect(mapDodoStatus('active')).toBe('active')
    expect(mapDodoStatus('past_due')).toBe('active')
    expect(mapDodoStatus('on_hold')).toBe('past_due')
  })

  test('paused / cancelled / expired / failed 映射', () => {
    expect(mapDodoStatus('paused')).toBe('expired')
    expect(mapDodoStatus('cancelled')).toBe('cancelled')
    expect(mapDodoStatus('expired')).toBe('expired')
    expect(mapDodoStatus('failed')).toBe('expired')
  })
})

describe('isDodoAccessActive', () => {
  test('仅本地 active 授 Pro；本地 past_due（=Dodo on_hold）不授', () => {
    expect(isDodoAccessActive('active')).toBe(true)
    expect(isDodoAccessActive('past_due')).toBe(false)
    expect(isDodoAccessActive('cancelled')).toBe(false)
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
      snapshot({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        cancelledAt: '2026-08-15T00:00:00.000Z'
      }),
      USER_ID,
      'dodo_webhook'
    )
    expect(record.status).toBe('active')
    expect(record.cancel_at_period_end).toBe(true)
    expect(record.tier).toBe('pro')
    expect(record.source).toBe('dodo_webhook')
  })
})
