/**
 * Gumroad 订阅记录构建
 */

import type { Subscription } from '@yiveno/types'
import type { SubscriptionTier } from '@yiveno/types'
import type { GumroadWebhookPayload } from './webhook-parser'
import { toBoolean, toIsoDate } from '../../utils/gumroad-helpers'

/** 从 webhook payload 构建订阅记录 */
export function buildSubscriptionRecord(
  payload: GumroadWebhookPayload,
  userId: string,
  subscriptionId: string,
  tier: SubscriptionTier
): Partial<Subscription> {
  const cancelled = toBoolean(payload.cancelled)
  const endedAt = toIsoDate(payload.ended_at)
  const { currentPeriodStart, currentPeriodEnd } = computePeriodDates(payload, endedAt)
  const status = computeSubscriptionStatus(endedAt, payload)
  // ended → 立刻收回：cancel_at_period_end 仅用于仍 active 的「期末取消」意图
  const cancelAtPeriodEnd = status === 'active' && cancelled && !endedAt
  const nowIso = new Date().toISOString()

  return {
    user_id: userId,
    gumroad_subscription_id: subscriptionId,
    gumroad_order_id: payload.order_id || payload.sale_id || payload.purchase_id || null,
    gumroad_variant_id: payload.plan_id || payload.price_id || null,
    status,
    tier,
    current_period_start: currentPeriodStart,
    // ended 时 period_end 压到结束时刻，避免 active 过滤误放行
    current_period_end: status === 'expired' ? endedAt || nowIso : currentPeriodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancelled_at: endedAt || (status === 'expired' ? nowIso : null),
    source: 'gumroad_webhook',
    last_verified_at: nowIso,
    verification_status: 'verified',
    gumroad_subscriber_status:
      status === 'expired' ? 'ended' : status === 'past_due' ? 'failed' : 'alive'
  }
}

/** 计算订阅周期起止日期 */
export function computePeriodDates(
  payload: GumroadWebhookPayload,
  endedAt: string | null
): { currentPeriodStart: string; currentPeriodEnd: string } {
  const nextChargeAt =
    toIsoDate(payload.next_charge_at) ||
    toIsoDate(payload.renewal_at) ||
    toIsoDate(payload.subscription_renewal_at)
  const currentPeriodEnd = nextChargeAt || endedAt || new Date().toISOString()
  const currentPeriodStart =
    toIsoDate(payload.charge_created_at) ||
    toIsoDate(payload.sale_timestamp) ||
    new Date().toISOString()
  return { currentPeriodStart, currentPeriodEnd }
}

/**
 * 根据结束状态和失败标记计算订阅状态。
 * ended_at 存在 → 立刻 expired（§A.3.2）。
 */
export function computeSubscriptionStatus(
  endedAt: string | null,
  payload: GumroadWebhookPayload
): Subscription['status'] {
  if (endedAt) return 'expired'
  const isFailed =
    toBoolean(payload.is_failed || payload.failed) || toBoolean(payload.charge_failed)
  return isFailed ? 'past_due' : 'active'
}
