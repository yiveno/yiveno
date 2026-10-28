/**
 * 将 Dodo 实体映射为 Yiveno 订阅投影。
 */

import type { Subscription, SubscriptionSource, SubscriptionStatus } from '@yiveno/types'
import type { DodoSubscriptionSnapshot } from './dodo-client'
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

export function extractYivenoUserId(metadata: unknown): string | null {
  const userId = readString(asRecord(metadata), 'yiveno_user_id')
  return isValidYivenoUserId(userId) ? userId : null
}

/**
 * Dodo status → 归一化订阅状态。
 * - Dodo `past_due`（宽限期内仍可用）→ 本地 `active`（`provider_status` 仍记 past_due）
 * - Dodo `on_hold`（已停权）→ 本地 `past_due`（历史命名；isDodoAccessActive=false）
 * - cancelled + 周期末取消在 snapshotToSubscriptionRecord 里提升为仍 active
 */
export function mapDodoStatus(dodoStatus: string): SubscriptionStatus {
  switch (dodoStatus) {
    case 'active':
      return 'active'
    case 'past_due':
      // Grace：顾客保持权益至 past_due_ends_at（对账/webhook 均须保留 Pro）
      return 'active'
    case 'on_hold':
      return 'past_due'
    case 'paused':
      return 'expired'
    case 'cancelled':
      return 'cancelled'
    case 'pending':
    case 'failed':
    case 'expired':
      return 'expired'
    default:
      return 'expired'
  }
}

export function isDodoAccessActive(status: SubscriptionStatus): boolean {
  return status === 'active'
}

export function snapshotToSubscriptionRecord(
  snapshot: DodoSubscriptionSnapshot,
  userId: string,
  source: Extract<SubscriptionSource, 'dodo_webhook' | 'dodo_verify'>
): Partial<Subscription> {
  const nowIso = new Date().toISOString()
  let status = mapDodoStatus(snapshot.status)
  const cancelAtPeriodEnd = snapshot.cancelAtPeriodEnd && snapshot.status === 'cancelled'
  if (cancelAtPeriodEnd) {
    status = 'active'
  }

  const periodEnd = snapshot.currentPeriodEnd || nowIso
  const periodStart = snapshot.currentPeriodStart || nowIso

  return {
    user_id: userId,
    provider_subscription_id: snapshot.id,
    provider_transaction_id: snapshot.paymentId,
    provider_price_id: snapshot.productId,
    provider_customer_id: snapshot.customerId,
    status,
    tier: 'pro',
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd || (status === 'active' && snapshot.cancelAtPeriodEnd),
    cancelled_at:
      status === 'cancelled' || status === 'expired' ? snapshot.cancelledAt || nowIso : null,
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
    source: 'dodo_verify',
    last_verified_at: nowIso,
    verification_status: verificationStatus,
    provider_status: providerStatus
  }
}
