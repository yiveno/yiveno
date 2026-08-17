/**
 * Dodo webhook → 归一化 → 订阅/支付投影。
 */

import type { PaymentRecord, PaymentStatus } from '@yiveno/types'
import {
  deleteBillingEvent,
  getSubscriptionByProviderId,
  insertBillingEvent,
  insertPaymentRecord,
  upsertSubscription
} from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, warn } from '../../utils/logger'
import { mapDodoSubscriptionEntity } from './dodo-client'
import {
  expireSubscriptionPatch,
  extractYivenoUserId,
  snapshotToSubscriptionRecord
} from './normalize'
import { hashWebhookPayload, type DodoWebhookEvent } from './dodo-webhook'
import { isFakeProviderSubscriptionId, isValidYivenoUserId } from './subscription-id'

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.active',
  'subscription.updated',
  'subscription.renewed',
  'subscription.plan_changed',
  'subscription.cancelled',
  'subscription.on_hold',
  'subscription.failed',
  'subscription.expired'
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readAmount(record: Record<string, unknown> | null): number {
  const raw = record?.total_amount ?? record?.amount
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export type ProjectWebhookResult = {
  /** applied：已投影 · ignored：已知但不处理 · rejected：硬门槛拒绝 · duplicate：重复 event_id */
  outcome: 'applied' | 'ignored' | 'rejected' | 'duplicate'
  reason?: string | undefined
}

async function claimEvent(
  env: Env,
  event: DodoWebhookEvent,
  rawBody: string,
  result: 'applied' | 'ignored' | 'rejected',
  userId: string | null,
  skipReason?: string
): Promise<boolean> {
  return insertBillingEvent(env, {
    provider: 'dodo',
    provider_event_id: event.eventId,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    user_id: userId,
    result,
    skip_reason: skipReason ?? null,
    payload_hash: hashWebhookPayload(rawBody)
  })
}

async function applySubscriptionEvent(
  env: Env,
  event: DodoWebhookEvent
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const snapshot = mapDodoSubscriptionEntity(event.data)
  if (!snapshot) {
    return { reason: 'invalid_subscription', userId: null, rejected: true }
  }
  if (isFakeProviderSubscriptionId(snapshot.id)) {
    warn('[Billing] 假订阅 ID，拒绝授 Pro', { eventType: event.eventType })
    return { reason: 'fake_subscription_id', userId: null, rejected: true }
  }

  const userId = snapshot.customUserId
  if (!userId || !isValidYivenoUserId(userId)) {
    warn('[Billing] 孤立付款：缺 metadata.yiveno_user_id，不开 Pro', {
      eventType: event.eventType,
      subscriptionId: snapshot.id
    })
    return { reason: 'missing_user_id', userId: null, rejected: true }
  }

  const existing = await getSubscriptionByProviderId(env, snapshot.id)
  if (
    existing?.last_verified_at &&
    event.occurredAt &&
    Date.parse(event.occurredAt) < Date.parse(existing.last_verified_at)
  ) {
    info('[Billing] 乱序事件已忽略', { eventId: event.eventId, subscriptionId: snapshot.id })
    return { reason: 'stale_event', userId }
  }

  const record = snapshotToSubscriptionRecord(snapshot, userId, 'dodo_webhook')
  await upsertSubscription(env, record)
  info('[Billing] 订阅投影已更新', {
    eventType: event.eventType,
    subscriptionId: snapshot.id,
    status: record.status,
    userId
  })
  return { userId }
}

async function applyPaymentEvent(
  env: Env,
  event: DodoWebhookEvent,
  status: PaymentStatus
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const data = event.data
  const userId = extractYivenoUserId(data.metadata)
  const subscriptionId = readString(data, 'subscription_id')
  const paymentId = readString(data, 'payment_id') || readString(data, 'id')
  if (!paymentId) {
    return { reason: 'missing_payment_id', userId, rejected: true }
  }

  let resolvedUserId = userId
  if (!resolvedUserId && subscriptionId) {
    const row = await getSubscriptionByProviderId(env, subscriptionId)
    resolvedUserId = row?.user_id ?? null
  }
  if (!resolvedUserId || !isValidYivenoUserId(resolvedUserId)) {
    return { reason: 'missing_user_id', userId: null, rejected: true }
  }

  const payment: PaymentRecord = {
    user_id: resolvedUserId,
    provider_subscription_id: subscriptionId,
    provider_transaction_id: paymentId,
    provider_payment_id: paymentId,
    amount: readAmount(data),
    currency: readString(data, 'currency') || 'USD',
    status,
    payment_method: readString(data, 'payment_method') || readString(data, 'payment_method_type'),
    event_type: event.eventType,
    metadata: {
      status: data.status ?? null
    }
  }
  await insertPaymentRecord(env, payment)
  info('[Billing] 支付记录已写入', {
    eventType: event.eventType,
    paymentId,
    status,
    userId: resolvedUserId
  })
  return { userId: resolvedUserId }
}

function isPartialRefund(data: Record<string, unknown>): boolean {
  if (data.is_partial === true) return true
  const type = readString(data, 'type') || readString(data, 'refund_type')
  return type === 'partial'
}

async function applyRefundEvent(
  env: Env,
  event: DodoWebhookEvent
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const data = event.data
  const subscriptionId = readString(data, 'subscription_id')
  const paymentId = readString(data, 'payment_id')
  const row = subscriptionId ? await getSubscriptionByProviderId(env, subscriptionId) : null
  const userId = row?.user_id ?? extractYivenoUserId(data.metadata)
  if (!userId || !isValidYivenoUserId(userId)) {
    return { reason: 'missing_user_id', userId: null, rejected: true }
  }

  await insertPaymentRecord(env, {
    user_id: userId,
    provider_subscription_id: subscriptionId,
    provider_transaction_id: paymentId,
    provider_payment_id: readString(data, 'refund_id') || readString(data, 'id'),
    amount: readAmount(data),
    currency: readString(data, 'currency') || 'USD',
    status: 'refunded',
    event_type: event.eventType,
    metadata: { is_partial: isPartialRefund(data) }
  })

  if (!isPartialRefund(data) && row) {
    await upsertSubscription(env, expireSubscriptionPatch(row, 'refunded', 'verified'))
    info('[Billing] 全额退款，已收回 Pro', { userId, subscriptionId })
  } else {
    info('[Billing] 部分退款，维持订阅投影', { userId, subscriptionId })
  }
  return { userId }
}

/**
 * 处理已验签的 Dodo event。重复 webhook-id 不二次投影。
 */
export async function projectDodoWebhook(
  env: Env,
  event: DodoWebhookEvent,
  rawBody: string
): Promise<ProjectWebhookResult> {
  const type = event.eventType
  info('[Billing] 处理 webhook', { eventId: event.eventId, eventType: type })

  const claimed = await claimEvent(env, event, rawBody, 'applied', null)
  if (!claimed) {
    info('[Billing] 重复 webhook，已忽略', { eventId: event.eventId, eventType: type })
    return { outcome: 'duplicate' }
  }

  try {
    if (SUBSCRIPTION_EVENTS.has(type)) {
      const applied = await applySubscriptionEvent(env, event)
      return {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    }

    if (type === 'payment.succeeded') {
      const applied = await applyPaymentEvent(env, event, 'paid')
      return {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    }

    if (type === 'payment.failed') {
      const applied = await applyPaymentEvent(env, event, 'failed')
      return {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    }

    if (type === 'refund.succeeded') {
      const applied = await applyRefundEvent(env, event)
      return {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    }

    info('[Billing] 未支持的 webhook event，已忽略', { eventType: type, eventId: event.eventId })
    return { outcome: 'ignored', reason: 'unsupported_event' }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 投影失败', { eventId: event.eventId, eventType: type, detail })
    await deleteBillingEvent(env, event.eventId)
    throw err
  }
}
