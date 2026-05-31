/**
 * Gumroad Webhook Payload 解析
 */

import type { SubscriptionTier } from '@ottersage/types'

/** Gumroad Webhook payload 的基本结构 */
export interface GumroadWebhookPayload {
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
  [key: string]: string | boolean | undefined
}

/** 解析 application/x-www-form-urlencoded webhook 请求体 */
export function parseWebhookPayload(rawBody: string): GumroadWebhookPayload {
  const params = new URLSearchParams(rawBody)
  const result: GumroadWebhookPayload = {}
  for (const [key, value] of params.entries()) {
    result[key] = value
  }
  return result
}

/** 从 payload 自定义字段中提取 userId 和 tier */
export function extractCustomFields(payload: GumroadWebhookPayload): {
  userId: string | null
  tier: SubscriptionTier
} {
  const userId = payload['custom_fields[user_id]'] || payload['custom_fields[userId]'] || null
  const tier = (payload['custom_fields[tier]'] || 'pro') as SubscriptionTier
  return { userId, tier }
}
