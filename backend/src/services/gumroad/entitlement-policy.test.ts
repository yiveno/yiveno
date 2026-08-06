import { describe, expect, test } from 'bun:test'
import { decideEntitlementFreshness } from './entitlement-policy'
import {
  hasOrderEvidence,
  isFakeGumroadSubscriptionId,
  isValidYivenoUserId
} from './subscription-id'
import { isGumroadSubscriberAlive } from './subscriber-api'

describe('subscription-id', () => {
  test('拒绝 test- 与过短 ID', () => {
    expect(isFakeGumroadSubscriptionId('test-gumroad-001')).toBe(true)
    expect(isFakeGumroadSubscriptionId('short')).toBe(true)
    expect(isFakeGumroadSubscriptionId('sub_abc12345')).toBe(false)
  })

  test('user_id 须为 UUID', () => {
    expect(isValidYivenoUserId('user_123')).toBe(false)
    expect(isValidYivenoUserId('11111111-1111-4111-8111-111111111111')).toBe(true)
  })

  test('订单证据', () => {
    expect(hasOrderEvidence(null, 'sale_1')).toBe(true)
    expect(hasOrderEvidence('order_1', null)).toBe(true)
    expect(hasOrderEvidence(null, null)).toBe(false)
  })
})

describe('entitlement-policy', () => {
  const now = Date.parse('2026-08-06T12:00:00.000Z')

  test('24h 内 verified → fresh', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'verified',
        lastVerifiedAt: '2026-08-06T00:00:00.000Z',
        nowMs: now
      })
    ).toBe('fresh')
  })

  test('超过 24h → reconcile', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'verified',
        lastVerifiedAt: '2026-08-04T00:00:00.000Z',
        nowMs: now
      })
    ).toBe('reconcile')
  })

  test('API 失败且在 48h grace → grace_ok', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'verified',
        lastVerifiedAt: '2026-08-05T00:00:00.000Z',
        nowMs: now,
        apiFailed: true
      })
    ).toBe('grace_ok')
  })

  test('mismatch → deny', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'mismatch',
        lastVerifiedAt: '2026-08-06T11:00:00.000Z',
        nowMs: now
      })
    ).toBe('deny')
  })
})

describe('subscriber-api', () => {
  test('仅 alive 视为有效', () => {
    expect(isGumroadSubscriberAlive('alive')).toBe(true)
    expect(isGumroadSubscriberAlive('cancelled')).toBe(false)
    expect(isGumroadSubscriberAlive('pending_cancellation')).toBe(false)
  })
})
