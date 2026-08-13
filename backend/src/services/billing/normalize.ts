/**
 * 将 Paddle 实体映射为 Yiveno 订阅投影。
 */

import type { Subscription, SubscriptionStatus } from '@yiveno/types'
import type { PaddleSubscriptionSnapshot } from './paddle-client'
import { isValidYivenoUserId } from './subscription-id'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function extractYivenoUserId(customData: unknown): string | null {
  const userId = readString(asRecord(customData), 'yiveno_user_id')
  return isValidYivenoUserId(userId) ? userId : null
}

/**
 * Paddle status → 归一化订阅状态。
 * trialing 视为 active（授 Pro）；canceled 用英式 cancelled。
 */
export function mapPaddleStatus(paddleStatus: string): SubscriptionStatus {
  switch (paddleStatus) {
    case 'trialing':
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'paused':
      return 'paused'
    case 'canceled':
      return 'cancelled'
    default:
      return 'expired'
  }
}

export function isPaddleAccessActive(status: SubscriptionStatus): boolean {
  return status === 'active'
}

export function snapshotToSubscriptionRecord(
  snapshot: PaddleSubscriptionSnapshot,
  userId: string,
  source: 'paddle_webhook' | 'paddle_verify'
): Partial<Subscription> {
  const nowIso = new Date().toISOString()
  const status = mapPaddleStatus(snapshot.status)
  const periodEnd = snapshot.currentPeriodEnd || nowIso
  const periodStart = snapshot.currentPeriodStart || nowIso
  const cancelAtPeriodEnd = status === 'active' && snapshot.cancelAtPeriodEnd

  return {
    user_id: userId,
    provider_subscription_id: snapshot.id,
    provider_transaction_id: snapshot.transactionId,
    provider_price_id: snapshot.priceId,
    provider_customer_id: snapshot.customerId,
    status,
    tier: 'pro',
    current_period_start: periodStart,
    current_period_end: status === 'cancelled' || status === 'expired' ? periodEnd : periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancelled_at:
      status === 'cancelled' || status === 'expired'
        ? snapshot.scheduledChangeEffectiveAt || nowIso
        : null,
    source,
    last_verified_at: nowIso,
    verification_status: 'verified',
    provider_status: snapshot.status
  }
}

export function expireSubscriptionPatch(
  row: Subscription,
  providerStatus: string,
  verificationStatus: 'mismatch' | 'verified'
): Partial<Subscription> {
  const nowIso = new Date().toISOString()
  return {
    user_id: row.user_id,
    provider_subscription_id: row.provider_subscription_id ?? null,
    provider_transaction_id: row.provider_transaction_id ?? null,
    provider_price_id: row.provider_price_id ?? null,
    provider_customer_id: row.provider_customer_id ?? null,
    status: 'expired',
    tier: row.tier === 'pro' || row.tier === 'premium' ? row.tier : 'pro',
    current_period_start: row.current_period_start,
    current_period_end: nowIso,
    cancel_at_period_end: false,
    cancelled_at: nowIso,
    source: 'paddle_verify',
    last_verified_at: nowIso,
    verification_status: verificationStatus,
    provider_status: providerStatus
  }
}
