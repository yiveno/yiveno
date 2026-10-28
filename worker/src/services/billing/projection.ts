/**
 * Dodo webhook → 归一化 → 订阅/支付投影。
 */

import type { PaymentRecord, PaymentStatus, Subscription } from '@yiveno/types'
import {
  deleteBillingEvent,
  getPaymentRecordByProviderTransactionId,
  getSubscriptionByProviderId,
  insertBillingEvent,
  insertPaymentRecord,
  updateBillingEventResult,
  upsertSubscription
} from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, warn } from '../../utils/logger'
import {
  cancelDodoSubscriptionImmediate,
  fetchDodoPayment,
  mapDodoSubscriptionEntity
} from './dodo-client'
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
  'subscription.past_due', // 宽限期：仍授 Pro（map → active）
  'subscription.paused', // 暂停：停权
  'subscription.unpaused', // 恢复：跟 payload status
  'subscription.failed',
  'subscription.expired'
])

/** 争议失败：资金退回顾客，须收回 Pro（与全额退款同级） */
const DISPUTE_REVOKE_EVENTS = new Set(['dispute.lost', 'dispute.accepted'])

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

/** Refund payload 偶发 subscription_ids[]；优先取显式 subscription_id。 */
function readSubscriptionIdFromRefundData(data: Record<string, unknown>): string | null {
  const direct = readString(data, 'subscription_id')
  if (direct) return direct
  const ids = data.subscription_ids
  if (Array.isArray(ids) && typeof ids[0] === 'string' && ids[0].trim()) {
    return ids[0].trim()
  }
  return null
}

/**
 * 解析退款对应的订阅行与 user。
 * Dodo Refund webhook 常无 subscription_id / yiveno_user_id → 经 payment_id 反查本机支付行或 Dodo payment。
 */
async function resolveRefundSubscriptionContext(
  env: Env,
  data: Record<string, unknown>
): Promise<{
  subscriptionId: string | null
  row: Subscription | null
  userId: string | null
}> {
  let subscriptionId = readSubscriptionIdFromRefundData(data)
  let row = subscriptionId ? await getSubscriptionByProviderId(env, subscriptionId) : null
  let userId = row?.user_id ?? extractYivenoUserId(data.metadata)

  const paymentId = readString(data, 'payment_id')
  if (paymentId && (!row || !userId || !subscriptionId)) {
    const payRow = await getPaymentRecordByProviderTransactionId(env, paymentId)
    if (payRow) {
      if (!subscriptionId && payRow.provider_subscription_id) {
        subscriptionId = payRow.provider_subscription_id
      }
      if (!userId && payRow.user_id && isValidYivenoUserId(payRow.user_id)) {
        userId = payRow.user_id
      }
      if (!row && subscriptionId) {
        row = await getSubscriptionByProviderId(env, subscriptionId)
        userId = row?.user_id ?? userId
      }
    }
  }

  if (paymentId && (!row || !subscriptionId)) {
    const fetched = await fetchDodoPayment(env, paymentId)
    if (fetched.ok) {
      if (!subscriptionId && fetched.payment.subscriptionId) {
        subscriptionId = fetched.payment.subscriptionId
      }
      if (!userId) {
        userId = extractYivenoUserId(fetched.payment.metadata)
      }
      if (!row && subscriptionId) {
        row = await getSubscriptionByProviderId(env, subscriptionId)
        userId = row?.user_id ?? userId
      }
    } else {
      warn('[Billing] 退款反查 Dodo payment 失败', {
        paymentId,
        reason: fetched.reason,
        detail: fetched.detail
      })
    }
  }

  return { subscriptionId, row, userId: userId ?? null }
}

async function applyRefundEvent(
  env: Env,
  event: DodoWebhookEvent
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const data = event.data
  const paymentId = readString(data, 'payment_id')
  const {
    subscriptionId,
    row,
    userId: resolvedUserId
  } = await resolveRefundSubscriptionContext(env, data)
  const userId = resolvedUserId
  if (!userId || !isValidYivenoUserId(userId)) {
    warn('[Billing] 退款无法解析 user（缺 subscription / payment 关联）', {
      paymentId,
      subscriptionId
    })
    return { reason: 'missing_user_id', userId: null, rejected: true }
  }

  // 唯一键用 refund_id，避免与原 payment.succeeded 的 provider_transaction_id=payment_id 撞 23505
  const refundId = readString(data, 'refund_id') || readString(data, 'id')
  await insertPaymentRecord(env, {
    user_id: userId,
    provider_subscription_id: subscriptionId ?? row?.provider_subscription_id ?? null,
    provider_transaction_id: refundId || paymentId,
    provider_payment_id: paymentId,
    amount: readAmount(data),
    currency: readString(data, 'currency') || 'USD',
    status: 'refunded',
    event_type: event.eventType,
    metadata: { is_partial: isPartialRefund(data), payment_id: paymentId }
  })

  if (isPartialRefund(data)) {
    info('[Billing] 部分退款，维持订阅投影', { userId, subscriptionId, paymentId })
    return { userId }
  }

  if (!row) {
    warn('[Billing] 全额退款但无本地订阅行，无法 expire（已记退款 payment）', {
      userId,
      subscriptionId,
      paymentId
    })
    return { userId }
  }

  await upsertSubscription(env, {
    ...expireSubscriptionPatch(row, 'refunded', 'verified'),
    source: 'dodo_webhook'
  })
  info('[Billing] 全额退款，已收回 Pro', {
    userId,
    subscriptionId: row.provider_subscription_id,
    paymentId
  })

  // MoR 侧退款不自动取消订阅；立即 cancel，避免随后 dodo_verify 又刷回 active Pro
  const subToCancel = row.provider_subscription_id || subscriptionId
  if (subToCancel) {
    const cancelled = await cancelDodoSubscriptionImmediate(env, subToCancel)
    if (!cancelled.ok) {
      warn('[Billing] 全额退款后取消 Dodo 订阅失败（投影已 expire）', {
        subscriptionId: subToCancel,
        reason: cancelled.reason,
        detail: cancelled.detail
      })
    }
  }

  return { userId }
}

/**
 * 争议 lost/accepted：按 payment_id 反查订阅并 expire（与全额退款同权）。
 * opened 仅记账忽略——未败诉前不自动停权（避免误杀；可对账/人工处理）。
 */
async function applyDisputeRevokeEvent(
  env: Env,
  event: DodoWebhookEvent
): Promise<{ reason?: string; userId: string | null; rejected?: boolean }> {
  const data = event.data
  const paymentId = readString(data, 'payment_id')
  const {
    subscriptionId,
    row,
    userId: resolvedUserId
  } = await resolveRefundSubscriptionContext(env, data)
  const userId = resolvedUserId
  if (!userId || !isValidYivenoUserId(userId)) {
    warn('[Billing] 争议无法解析 user', {
      eventType: event.eventType,
      paymentId,
      subscriptionId
    })
    return { reason: 'missing_user_id', userId: null, rejected: true }
  }

  const disputeId = readString(data, 'dispute_id') || readString(data, 'id')
  await insertPaymentRecord(env, {
    user_id: userId,
    provider_subscription_id: subscriptionId ?? row?.provider_subscription_id ?? null,
    provider_transaction_id: disputeId || paymentId,
    provider_payment_id: paymentId,
    amount: readAmount(data),
    currency: readString(data, 'currency') || 'USD',
    status: 'refunded',
    event_type: event.eventType,
    metadata: { dispute: true, payment_id: paymentId }
  })

  if (!row) {
    warn('[Billing] 争议无本地订阅行，已记 payment', { userId, paymentId, subscriptionId })
    return { userId }
  }

  await upsertSubscription(env, {
    ...expireSubscriptionPatch(row, event.eventType, 'verified'),
    source: 'dodo_webhook'
  })
  info('[Billing] 争议败诉/接受，已收回 Pro', {
    userId,
    eventType: event.eventType,
    subscriptionId: row.provider_subscription_id
  })

  const subToCancel = row.provider_subscription_id || subscriptionId
  if (subToCancel) {
    const cancelled = await cancelDodoSubscriptionImmediate(env, subToCancel)
    if (!cancelled.ok) {
      warn('[Billing] 争议后取消 Dodo 订阅失败（投影已 expire）', {
        subscriptionId: subToCancel,
        reason: cancelled.reason
      })
    }
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

  // 先占位 applied；投影结束后按真实 outcome 回写（拒绝不得留「假 applied」）
  const claimed = await claimEvent(env, event, rawBody, 'applied', null)
  if (!claimed) {
    info('[Billing] 重复 webhook，已忽略', { eventId: event.eventId, eventType: type })
    return { outcome: 'duplicate' }
  }

  try {
    let outcome: ProjectWebhookResult = { outcome: 'ignored', reason: 'unsupported_event' }
    let appliedUserId: string | null = null

    if (SUBSCRIPTION_EVENTS.has(type)) {
      const applied = await applySubscriptionEvent(env, event)
      appliedUserId = applied.userId
      outcome = {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    } else if (type === 'payment.succeeded') {
      const applied = await applyPaymentEvent(env, event, 'paid')
      appliedUserId = applied.userId
      outcome = {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    } else if (type === 'payment.failed') {
      const applied = await applyPaymentEvent(env, event, 'failed')
      appliedUserId = applied.userId
      outcome = {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    } else if (type === 'refund.succeeded') {
      const applied = await applyRefundEvent(env, event)
      appliedUserId = applied.userId
      outcome = {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    } else if (DISPUTE_REVOKE_EVENTS.has(type)) {
      const applied = await applyDisputeRevokeEvent(env, event)
      appliedUserId = applied.userId
      outcome = {
        outcome: applied.rejected ? 'rejected' : 'applied',
        reason: applied.reason
      }
    } else {
      info('[Billing] 未支持的 webhook event，已忽略', { eventType: type, eventId: event.eventId })
    }

    // applied 且无 user 也回写 user_id=null 清占位；rejected/ignored 必回写 result
    await updateBillingEventResult(env, event.eventId, {
      result: outcome.outcome,
      skip_reason: outcome.reason ?? null,
      user_id: appliedUserId
    })

    return outcome
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 投影失败', { eventId: event.eventId, eventType: type, detail })
    await deleteBillingEvent(env, event.eventId)
    throw err
  }
}
