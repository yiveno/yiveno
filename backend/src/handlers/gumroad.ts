/**
 * Gumroad 处理器
 *
 * 职责：
 * - 查询当前用户订阅状态
 * - 处理 Gumroad Webhook，更新 Supabase 订阅与支付记录
 */

import type { Env } from '../types/env'
import { okJson, errorJson } from '../utils/response'
import { parseWebhookPayload, extractCustomFields } from '../services/gumroad/webhook-parser'
import { webhookVerifySeller } from '../services/gumroad/signature'
import { buildSubscriptionRecord } from '../services/gumroad/subscription'
import { insertPaymentIfCharged } from '../services/gumroad/payment'
import type { Subscription } from '@ottersage/types'
import { error as logErrorMessage, info } from '../utils/logger'

interface SubscriptionDto {
  id: string | null
  status: Subscription['status']
  tier: Subscription['tier']
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

function toSubscriptionDto(subscription: Subscription | null): SubscriptionDto | null {
  if (!subscription) return null
  return {
    id: subscription.id ?? null,
    status: subscription.status,
    tier: subscription.tier,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false
  }
}

/** GET /api/gumroad/subscription?user_id=xxx */
export async function handleGetSubscription(
  request: Request,
  env: Env,
  origin: string | null
): Promise<Response> {
  if (request.method !== 'GET') {
    return errorJson({ error: 'Method not allowed' }, 405, origin)
  }

  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')

    if (!userId) {
      return errorJson({ error: 'Missing user_id parameter' }, 400, origin)
    }

    const supabase = await import('../data-access/supabase')
    const subscription = await supabase.getUserSubscription(env, userId)

    return okJson(
      {
        success: true,
        data: {
          hasSubscription: Boolean(subscription),
          subscription: toSubscriptionDto(subscription)
        }
      },
      origin
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Gumroad] 获取订阅失败', { detail: msg })
    return errorJson({ error: 'Internal server error' }, 500, origin)
  }
}

/** POST /api/gumroad/webhook */
export async function handleWebhook(
  request: Request,
  env: Env,
  origin: string | null
): Promise<Response> {
  if (request.method !== 'POST') {
    return errorJson({ error: 'Method not allowed' }, 405, origin)
  }

  const rawBody = await request.text()

  const payload = parseWebhookPayload(rawBody)
  const sellerCheck = await webhookVerifySeller(env.GUMROAD_SELLER_ID || '', payload)
  if (sellerCheck) return sellerCheck

  const notificationType = payload.notification_type || payload.kind || 'unknown'
  const subscriptionId = payload.subscription_id || payload.sale_id || null
  const { userId, tier } = extractCustomFields(payload)

  if (!subscriptionId || !userId) {
    logErrorMessage('[Gumroad] Webhook 缺少 subscription_id 或 user_id', {
      notificationType,
      hasSubscriptionId: Boolean(subscriptionId),
      hasUserId: Boolean(userId)
    })
    return errorJson({ error: 'Missing subscription_id or user_id' }, 400, origin)
  }

  try {
    const supabase = await import('../data-access/supabase')

    const subscriptionRecord = buildSubscriptionRecord(payload, userId, subscriptionId, tier)
    await supabase.upsertSubscription(env, subscriptionRecord)

    await insertPaymentIfCharged(
      payload,
      { userId, gumroadSubscriptionId: subscriptionId, notificationType },
      env,
      supabase
    )

    info('[Gumroad] Webhook 处理完成', { notificationType, subscriptionId })
    return okJson({ success: true }, origin)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Gumroad] 处理 Webhook 异常', { detail: msg })
    return errorJson({ error: 'Internal server error' }, 500, origin)
  }
}
