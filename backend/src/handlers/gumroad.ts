/**
 * Gumroad 处理器
 *
 * 职责：
 * - 查询当前用户订阅状态（强制对账）
 * - 处理 Gumroad Webhook：硬门槛授 Pro + 事件账 + ended 立刻降级
 */

import type { Env } from '../types/env'
import { okJson, errorJson } from '../utils/response'
import { parseWebhookPayload, extractCustomFields } from '../services/gumroad/webhook-parser'
import { webhookVerifySeller } from '../services/gumroad/signature'
import { webhookVerifyToken } from '../services/gumroad/webhook-token'
import { buildSubscriptionRecord } from '../services/gumroad/subscription'
import { insertPaymentIfCharged } from '../services/gumroad/payment'
import { buildGumroadEventIdempotencyKey, hashWebhookPayload } from '../services/gumroad/event-key'
import {
  hasOrderEvidence,
  isFakeGumroadSubscriptionId,
  isValidYivenoUserId
} from '../services/gumroad/subscription-id'
import { insertGumroadEvent, upsertSubscription } from '../data-access/supabase'
import type { Subscription } from '@yiveno/types'
import { error as logErrorMessage, info, warn } from '../utils/logger'
import { getSubscriptionStatusOrThrow } from './subscription'

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

type EnvWithGumroad = Env & {
  GUMROAD_WEBHOOK_TOKEN?: string
}

/**
 * GET /api/gumroad/subscription
 *
 * userId 必须来自已校验 JWT 的 `sub`，禁止信任 query，避免 IDOR。
 */
export async function handleGetSubscription(
  request: Request,
  env: Env,
  origin: string | null,
  userId: string
): Promise<Response> {
  if (request.method !== 'GET') {
    return errorJson({ error: 'Method not allowed' }, 405, origin)
  }

  if (!userId.trim()) {
    return errorJson({ error: 'missing_subject' }, 401, origin)
  }

  try {
    const status = await getSubscriptionStatusOrThrow(env, userId, { reconcile: true })
    const supabase = await import('../data-access/supabase')
    const subscription = status.isPro ? await supabase.getUserSubscription(env, userId) : null

    return okJson(
      {
        success: true,
        data: {
          hasSubscription: Boolean(subscription),
          subscription: toSubscriptionDto(subscription),
          isPro: status.isPro
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

  const tokenCheck = webhookVerifyToken((env as EnvWithGumroad).GUMROAD_WEBHOOK_TOKEN, request)
  if (tokenCheck) return tokenCheck

  const rawBody = await request.text()
  const payloadHash = hashWebhookPayload(rawBody)
  const payload = parseWebhookPayload(rawBody)
  const sellerCheck = await webhookVerifySeller(env.GUMROAD_SELLER_ID || '', payload)
  if (sellerCheck) return sellerCheck

  const notificationType = payload.notification_type || payload.kind || 'unknown'
  const subscriptionId = payload.subscription_id || payload.sale_id || null
  const { userId, tier } = extractCustomFields(payload)
  const hasSellerId = Boolean((payload.seller_id || '').trim())
  const idempotencyKey = buildGumroadEventIdempotencyKey(payload)

  const recordEvent = async (
    result: 'applied' | 'skipped' | 'rejected' | 'error',
    skipReason?: string
  ) => {
    await insertGumroadEvent(env, {
      idempotency_key: `${idempotencyKey}|${result}|${skipReason || 'ok'}`,
      notification_type: notificationType,
      gumroad_subscription_id: subscriptionId,
      gumroad_order_id: payload.order_id || payload.sale_id || null,
      user_id: isValidYivenoUserId(userId) ? userId : null,
      result,
      skip_reason: skipReason ?? null,
      payload_hash: payloadHash
    })
  }

  // Gumroad「Send test ping」可能无 seller_id / custom_fields；回 200 以便连通性校验。
  if (!hasSellerId || !subscriptionId || !userId) {
    const reason = !hasSellerId
      ? 'missing_seller_id'
      : !subscriptionId
        ? 'missing_subscription_id'
        : 'missing_user_id'
    if (hasSellerId && subscriptionId && !userId) {
      warn('[Gumroad] 孤立付款：有订阅 id 但缺 custom_fields[user_id]，不开 Pro', {
        notificationType,
        subscriptionId
      })
    }
    info('[Gumroad] Webhook 探测或字段不全，已 ACK 并跳过写库', {
      notificationType,
      hasSellerId,
      hasSubscriptionId: Boolean(subscriptionId),
      hasUserId: Boolean(userId)
    })
    await recordEvent('skipped', reason)
    return okJson({ success: true, skipped: true, reason }, origin)
  }

  if (!isValidYivenoUserId(userId)) {
    warn('[Gumroad] user_id 非合法 UUID，拒绝授 Pro', { notificationType })
    await recordEvent('rejected', 'invalid_user_id')
    return okJson({ success: true, skipped: true, reason: 'invalid_user_id' }, origin)
  }

  if (isFakeGumroadSubscriptionId(subscriptionId)) {
    warn('[Gumroad] 假订阅 ID，拒绝授 Pro', { notificationType })
    await recordEvent('rejected', 'fake_subscription_id')
    return okJson({ success: true, skipped: true, reason: 'fake_subscription_id' }, origin)
  }

  try {
    const subscriptionRecord = buildSubscriptionRecord(payload, userId, subscriptionId, tier)

    // 激活 active 必须有订单证据
    if (
      subscriptionRecord.status === 'active' &&
      !hasOrderEvidence(payload.order_id || payload.purchase_id, payload.sale_id)
    ) {
      warn('[Gumroad] active 缺少 order/sale 证据，拒绝授 Pro', { notificationType })
      await recordEvent('rejected', 'missing_order_evidence')
      return okJson({ success: true, skipped: true, reason: 'missing_order_evidence' }, origin)
    }

    await upsertSubscription(env, subscriptionRecord)

    await insertPaymentIfCharged(
      payload,
      { userId, gumroadSubscriptionId: subscriptionId, notificationType },
      env
    )

    await recordEvent('applied')
    info('[Gumroad] Webhook 处理完成', {
      notificationType,
      subscriptionId,
      status: subscriptionRecord.status
    })
    return okJson({ success: true }, origin)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Gumroad] 处理 Webhook 异常', { detail: msg })
    await recordEvent('error', msg.slice(0, 120))
    return errorJson({ error: 'Internal server error' }, 500, origin)
  }
}
