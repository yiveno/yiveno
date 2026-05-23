import type { Env } from './types/env'
import type { Subscription, PaymentRecord, SubscriptionTier } from '@acuity-bookmarks/types'

// Gumroad 集成处理器
// 职责：
// - 查询当前用户订阅状态
// - 处理 Gumroad Webhook，更新 Supabase 订阅与支付记录

/**
 * Gumroad Webhook payload 的基本结构
 * 字段非常动态，这里只定义代码中实际用到的部分
 */
interface GumroadWebhookPayload {
  notification_type?: string
  kind?: string
  subscription_id?: string
  sale_id?: string
  'custom_fields[user_id]'?: string
  'custom_fields[userId]'?: string
  'custom_fields[tier]'?: string
  cancelled?: string | boolean
  ended_at?: string
  next_charge_at?: string
  renewal_at?: string
  subscription_renewal_at?: string
  charge_created_at?: string
  sale_timestamp?: string
  is_failed?: string | boolean
  failed?: string | boolean
  charge_failed?: string | boolean
  order_id?: string
  purchase_id?: string
  plan_id?: string
  price_id?: string
  charge_id?: string
  price?: string
  charge_amount?: string
  currency?: string
  payment_method?: string
  [key: string]: string | boolean | undefined // 允许其他未知字段
}

/**
 * 构建 JSON 响应
 */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

/**
 * 解析 Gumroad Webhook 请求体（application/x-www-form-urlencoded）
 */
function parseWebhookPayload(rawBody: string): GumroadWebhookPayload {
  const params = new URLSearchParams(rawBody)
  const result: GumroadWebhookPayload = {}
  for (const [key, value] of params.entries()) {
    result[key] = value
  }
  return result
}

/**
 * 验证 Gumroad Webhook 签名
 */
async function verifySignature(
  secret: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  if (!secret) {
    console.warn('[Gumroad] 未配置 GUMROAD_WEBHOOK_SECRET，跳过验签')
    return true
  }
  if (!signature) {
    console.warn('[Gumroad] Webhook 缺少签名头')
    return false
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expectedHex = bufferToHex(signatureBuffer)
  // Gumroad 文档未说明是否区分大小写，这里统一转小写比较
  return timingSafeEqual(expectedHex.toLowerCase(), signature.toLowerCase())
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function toBoolean(flag: unknown): boolean {
  return flag === true || flag === 'true' || flag === '1'
}

function toIsoDate(value: unknown, fallback: string | null = null): string | null {
  if (!value) return fallback
  const date = new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

/**
 * GET /api/gumroad/subscription?user_id=xxx
 */
export async function handleGetSubscription(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')

    if (!userId) {
      return json({ success: false, error: 'Missing user_id parameter' }, 400)
    }

    const supabase = await import('./utils/supabase.ts')
    const subscription = await supabase.getUserSubscription(env, userId)

    // ✅ 统一返回格式：subscription 字段永远存在，但可能为 null
    // 这样前端可以安全地访问 response.subscription
    if (!subscription) {
      return json({
        success: true,
        subscription: null,
        // ✅ 添加明确的标志位，避免前端需要判断 null
        hasSubscription: false
      })
    }

    return json({
      success: true,
      hasSubscription: true,
      subscription: {
        id: subscription.gumroad_subscription_id || subscription.id || null,
        status: subscription.status,
        tier: subscription.tier || 'free',
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
      }
    })
  } catch (error) {
    console.error('[Gumroad] 查询订阅失败:', error)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
}

/**
 * POST /api/gumroad/webhook
 *
 * Gumroad 使用 Ping 功能发送通知，可能不使用签名验证
 * 可以通过 seller_id 或 IP 白名单进行验证（可选）
 */
export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  const rawBody = await request.text()

  // Gumroad Ping 可能不使用签名验证
  // 如果配置了 Secret，尝试验证；否则跳过（用于开发测试）
  const signature = request.headers.get('X-Gumroad-Signature') || ''
  const secret = env.GUMROAD_WEBHOOK_SECRET || ''

  // 如果配置了 Secret，进行验证
  if (secret && signature) {
    const valid = await verifySignature(secret, rawBody, signature)
    if (!valid) {
      console.error('[Gumroad] Webhook 验签失败')
      return json({ success: false, error: 'Invalid signature' }, 401)
    }
  } else {
    // 如果没有配置 Secret，记录警告但继续处理（开发环境）
    console.warn('[Gumroad] 未配置 Webhook Secret，跳过签名验证（仅用于开发测试）')
  }

  const payload = parseWebhookPayload(rawBody)
  const notificationType = payload.notification_type || payload.kind || 'unknown'
  const subscriptionId = payload.subscription_id || payload.sale_id || null
  const userId = payload['custom_fields[user_id]'] || payload['custom_fields[userId]'] || null
  const tier = (payload['custom_fields[tier]'] || 'pro') as SubscriptionTier

  if (!subscriptionId || !userId) {
    console.error('[Gumroad] Webhook 缺少 subscription_id 或 user_id', payload)
    return json({ success: false, error: 'Missing subscription_id or user_id' }, 400)
  }

  try {
    const supabase = await import('./utils/supabase.ts')

    const cancelled = toBoolean(payload.cancelled)
    const endedAt = toIsoDate(payload.ended_at)
    const nextChargeAt =
      toIsoDate(payload.next_charge_at) ||
      toIsoDate(payload.renewal_at) ||
      toIsoDate(payload.subscription_renewal_at)
    const currentPeriodEnd = nextChargeAt || endedAt || new Date().toISOString()
    const currentPeriodStart =
      toIsoDate(payload.charge_created_at) ||
      toIsoDate(payload.sale_timestamp) ||
      new Date().toISOString()

    const cancelAtPeriodEnd = cancelled && !endedAt
    const status: Subscription['status'] = endedAt
      ? 'expired'
      : toBoolean(payload.is_failed || payload.failed) || toBoolean(payload.charge_failed)
        ? 'past_due'
        : 'active'

    const subscriptionRecord: Partial<Subscription> = {
      user_id: userId,
      gumroad_subscription_id: subscriptionId,
      gumroad_order_id: payload.order_id || payload.sale_id || payload.purchase_id || null,
      gumroad_variant_id: payload.plan_id || payload.price_id || null,
      status,
      tier,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      cancelled_at: endedAt
    }

    await supabase.upsertSubscription(env, subscriptionRecord)

    // 插入支付记录（仅对收费事件）
    if (payload.charge_id || payload.sale_id) {
      const paymentRecord: PaymentRecord = {
        user_id: userId,
        subscription_id: subscriptionId,
        gumroad_order_id: payload.sale_id || payload.order_id || payload.purchase_id || null,
        gumroad_payment_id: payload.charge_id || null,
        amount: Number(payload.price || payload.charge_amount || 0),
        currency: payload.currency || 'USD',
        status,
        payment_method: payload.payment_method || null,
        event_type: notificationType,
        metadata: payload
      }
      await supabase.insertPaymentRecord(env, paymentRecord)
    }

    console.log('[Gumroad] Webhook 处理完成:', notificationType, subscriptionId)

    return json({ success: true })
  } catch (error) {
    console.error('[Gumroad] 处理 Webhook 异常:', error)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
}
