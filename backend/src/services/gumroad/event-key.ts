/**
 * 构建 Gumroad 入站幂等键与 payload 指纹
 */

import type { GumroadWebhookPayload } from './webhook-parser'

/** 稳定幂等键：类型 + 订阅/订单 + 扣款 id */
export function buildGumroadEventIdempotencyKey(payload: GumroadWebhookPayload): string {
  const type = (payload.notification_type || payload.kind || 'unknown').toLowerCase()
  const sub = payload.subscription_id || payload.sale_id || 'none'
  const order = payload.order_id || payload.purchase_id || payload.sale_id || 'none'
  const charge = payload.charge_id || 'none'
  return `${type}|${sub}|${order}|${charge}`
}

/** 轻量指纹（不存全文，避免敏感字段落库过多） */
export function hashWebhookPayload(rawBody: string): string {
  let h = 2166136261
  for (let i = 0; i < rawBody.length; i++) {
    h ^= rawBody.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `fnv1a_${(h >>> 0).toString(16)}`
}
