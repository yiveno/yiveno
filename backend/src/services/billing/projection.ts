/**
 * Paddle webhook → 归一化 → 订阅/支付投影。
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
import { mapPaddleSubscriptionEntity } from './paddle-client'
import {
  expireSubscriptionPatch,
  extractYivenoUserId,
  snapshotToSubscriptionRecord
} from './normalize'
import { hashWebhookPayload, type PaddleWebhookEvent } from './paddle-webhook'
import { isFakeProviderSubscriptionId, isValidYivenoUserId } from './subscription-id'

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.activated',
  'subscription.past_due',
  'subscription.paused',
  'subscription.resumed',
  'subscription.trialing'
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
  const totals = asRecord(record?.totals) || asRecord(asRecord(record?.details)?.totals)
  const raw = totals?.total ?? totals?.grand_total
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
  event: PaddleWebhookEvent,
  rawBody: string,
  result: 'applied' | 'ignored' | 'rejected',
  userId: string | null,
  skipReason?: string
): Promise<boolean> {
  return insertBillingEvent(env, {
    provider: 'paddle',
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
  event: PaddleWebhookEvent
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const snapshot = mapPaddleSubscriptionEntity(event.data)
  if (!snapshot) {
    return { reason: 'invalid_subscription', userId: null, rejected: true }
  }
  if (isFakeProviderSubscriptionId(snapshot.id)) {
    warn('[Billing] 假订阅 ID，拒绝授 Pro', { eventType: event.eventType })
    return { reason: 'fake_subscription_id', userId: null, rejected: true }
  }

  const userId = snapshot.customUserId
  if (!userId || !isValidYivenoUserId(userId)) {
    warn('[Billing] 孤立付款：缺 custom_data.yiveno_user_id，不开 Pro', {
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

  const record = snapshotToSubscriptionRecord(snapshot, userId, 'paddle_webhook')
  await upsertSubscription(env, record)
  info('[Billing] 订阅投影已更新', {
    eventType: event.eventType,
    subscriptionId: snapshot.id,
    status: record.status,
    userId
  })
  return { userId }
}

async function applyTransactionEvent(
  env: Env,
  event: PaddleWebhookEvent,
  status: PaymentStatus
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const data = event.data
  const userId = extractYivenoUserId(data.custom_data)
  const subscriptionId = readString(data, 'subscription_id')
  const transactionId = readString(data, 'id')
  if (!transactionId) {
    return { reason: 'missing_transaction_id', userId, rejected: true }
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
    provider_transaction_id: transactionId,
    provider_payment_id: readString(data, 'id'),
    amount: readAmount(data),
    currency: readString(data, 'currency_code') || 'USD',
    status,
    payment_method: null,
    event_type: event.eventType,
    metadata: {
      origin: data.origin ?? null,
      payout_totals: asRecord(data.details)?.payout_totals ?? null
    }
  }
  await insertPaymentRecord(env, payment)
  info('[Billing] 支付记录已写入', {
    eventType: event.eventType,
    transactionId,
    status,
    userId: resolvedUserId
  })
  return { userId: resolvedUserId }
}

async function applyRefundEvent(
  env: Env,
  event: PaddleWebhookEvent
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const data = event.data
  const action = readString(data, 'action')
  const adjStatus = readString(data, 'status')
  if (action !== 'refund' || adjStatus !== 'approved') {
    return { reason: 'refund_not_approved', userId: null }
  }

  const subscriptionId = readString(data, 'subscription_id')
  const transactionId = readString(data, 'transaction_id')
  const row = subscriptionId ? await getSubscriptionByProviderId(env, subscriptionId) : null
  const userId = row?.user_id ?? null
  if (!userId || !isValidYivenoUserId(userId)) {
    return { reason: 'missing_user_id', userId: null, rejected: true }
  }

  const refundType = readString(data, 'type')
  await insertPaymentRecord(env, {
    user_id: userId,
    provider_subscription_id: subscriptionId,
    provider_transaction_id: transactionId,
    provider_payment_id: readString(data, 'id'),
    amount: readAmount(data),
    currency: readString(data, 'currency_code') || 'USD',
    status: 'refunded',
    event_type: event.eventType,
    metadata: { type: refundType }
  })

  if (refundType === 'full' && row) {
    await upsertSubscription(env, expireSubscriptionPatch(row, 'refunded', 'verified'))
    info('[Billing] 全额退款，已收回 Pro', { userId, subscriptionId })
  } else {
    info('[Billing] 部分退款，维持订阅投影', { userId, subscriptionId })
  }
  return { userId }
}

/**
 * 处理已验签的 Paddle event。重复 event_id 不二次投影。
 */
export async function projectPaddleWebhook(
  env: Env,
  event: PaddleWebhookEvent,
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

    if (type === 'transaction.completed') {
      const applied = await applyTransactionEvent(env, event, 'paid')
      return {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    }

    if (type === 'transaction.payment_failed') {
      const applied = await applyTransactionEvent(env, event, 'failed')
      return {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    }

    if (type === 'adjustment.updated' || type === 'adjustment.created') {
      const applied = await applyRefundEvent(env, event)
      if (applied.reason === 'refund_not_approved') {
        return { outcome: 'ignored', reason: applied.reason }
      }
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
