/**
 * Gumroad 支付记录处理
 */

import type { Env } from '../../types/env'
import type { PaymentRecord, PaymentStatus } from '@yiveno/types'
import { insertPaymentRecord } from '../../data-access/supabase'
import type { GumroadWebhookPayload } from './webhook-parser'

/** 支付上下文 */
export interface PaymentContext {
  userId: string
  gumroadSubscriptionId: string
  notificationType: string
}

/** 根据 Gumroad 事件计算支付状态 */
function computePaymentStatus(
  payload: GumroadWebhookPayload,
  notificationType: string
): PaymentStatus {
  const event = notificationType.toLowerCase()
  if (event.includes('refund')) return 'refunded'
  if (event.includes('fail') || payload.failed || payload.is_failed || payload.charge_failed)
    return 'failed'
  return 'paid'
}

/** 从 webhook payload 构建支付记录 */
export function buildPaymentRecord(
  payload: GumroadWebhookPayload,
  ctx: PaymentContext
): Partial<PaymentRecord> {
  return {
    user_id: ctx.userId,
    gumroad_subscription_id: ctx.gumroadSubscriptionId,
    gumroad_order_id: payload.order_id || payload.sale_id || payload.purchase_id || null,
    gumroad_payment_id: payload.charge_id || null,
    amount: Number(payload.price || payload.charge_amount || 0),
    currency: payload.currency || 'USD',
    status: computePaymentStatus(payload, ctx.notificationType),
    payment_method: payload.payment_method || null,
    event_type: ctx.notificationType,
    metadata: payload
  }
}

/** 如果 webhook 是收费事件则插入支付记录 */
export async function insertPaymentIfCharged(
  payload: GumroadWebhookPayload,
  ctx: PaymentContext,
  env: Env
): Promise<void> {
  const chargeEvents = ['sale', 'charge', 'payment_success', 'payment_failed', 'refund']
  const currentState = payload.notification_type || payload.kind || ''
  if (!chargeEvents.some(e => currentState.toLowerCase().includes(e.toLowerCase()))) {
    return
  }

  const paymentRecord = buildPaymentRecord(payload, ctx)
  await insertPaymentRecord(env, paymentRecord as PaymentRecord)
}
