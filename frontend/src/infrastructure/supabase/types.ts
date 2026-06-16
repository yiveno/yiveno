/**
 * Supabase 数据库类型定义
 *
 * 这些类型对应 Supabase 数据库中的表结构
 */

/**
 * 订阅状态
 */
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due' | 'paused'

/**
 * 订阅信息
 */
export interface Subscription {
  id: string
  user_id: string
  /** Gumroad 订阅 ID */
  gumroad_subscription_id: string
  /** Gumroad 订单/charge ID */
  gumroad_order_id: string | null
  /** Gumroad 计划 ID */
  gumroad_variant_id: string | null
  status: SubscriptionStatus
  tier: 'free' | 'pro'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

/**
 * 用户订阅状态查询结果
 */
export interface UserSubscriptionStatus {
  tier: 'free' | 'pro'
  status: SubscriptionStatus
  current_period_end: string
  cancel_at_period_end: boolean
}
