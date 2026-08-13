import { describe, expect, test } from 'bun:test'

import {
  ENTITLEMENT_VERIFY_GRACE_MS,
  ENTITLEMENT_VERIFY_TTL_MS,
  decideEntitlementFreshness
} from './entitlement-policy'

const now = Date.parse('2026-08-14T12:00:00.000Z')

describe('decideEntitlementFreshness', () => {
  test('mismatch → deny', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'mismatch',
        lastVerifiedAt: new Date(now).toISOString(),
        nowMs: now
      })
    ).toBe('deny')
  })

  test('24h 内 verified → fresh', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'verified',
        lastVerifiedAt: new Date(now - ENTITLEMENT_VERIFY_TTL_MS + 60_000).toISOString(),
        nowMs: now
      })
    ).toBe('fresh')
  })

  test('超过 24h → reconcile', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'verified',
        lastVerifiedAt: new Date(now - ENTITLEMENT_VERIFY_TTL_MS - 1).toISOString(),
        nowMs: now
      })
    ).toBe('reconcile')
  })

  test('API 失败且 48h 内 verified → grace_ok', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'verified',
        lastVerifiedAt: new Date(now - ENTITLEMENT_VERIFY_GRACE_MS + 60_000).toISOString(),
        nowMs: now,
        apiFailed: true
      })
    ).toBe('grace_ok')
  })

  test('API 失败且超过 grace → deny', () => {
    expect(
      decideEntitlementFreshness({
        verificationStatus: 'verified',
        lastVerifiedAt: new Date(now - ENTITLEMENT_VERIFY_GRACE_MS - 1).toISOString(),
        nowMs: now,
        apiFailed: true
      })
    ).toBe('deny')
  })
})
