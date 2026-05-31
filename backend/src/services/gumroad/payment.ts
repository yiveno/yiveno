/**
 * Gumroad 支付记录处理
 */

import type { Env } from '../../types/env'
import type { PaymentRecord, PaymentStatus } from '@ottersage/types'
import type { GumroadWebhookPayload } from './webhook-parser'

/** 支付上下文 */
export interface PaymentContext {
  userId: string
  subscriptionId: string
  status: string
  notificationType: string
}

/** 从 webhook payload 构建支付记录 */
export function buildPaymentRecord(
  payload: GumroadWebhookPayload,
  ctx: PaymentContext
): Partial<PaymentRecord> {
  return {
    user_id: ctx.userId,
    subscription_id: ctx.subscriptionId,
    gumroad_order_id: payload.charge_id || payload.sale_id || null,
    amount: Number(payload.price || payload.charge_amount || 0),
    currency: payload.currency || 'USD',
    status: ctx.status as PaymentStatus,
    payment_method: payload.payment_method || null,
    event_type: ctx.notificationType,
    metadata: payload
  }
}

/** 如果 webhook 是收费事件则插入支付记录 */
export async function insertPaymentIfCharged(
  payload: GumroadWebhookPayload,
  ctx: PaymentContext,
  env: Env,
  supabase: any
): Promise<void> {
  const chargeEvents = ['sale', 'charge', 'payment_success']
  const currentState = payload.notification_type || payload.kind || ''
  if (!chargeEvents.some(e => currentState.toLowerCase().includes(e.toLowerCase()))) {
    return
  }

  const paymentRecord = buildPaymentRecord(payload, ctx)
  await supabase.insertPaymentRecord(env, paymentRecord)
}
