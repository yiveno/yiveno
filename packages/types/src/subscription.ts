/**
 * 订阅状态。
 * - active：有效
 * - past_due：逾期
 * - cancelled：已取消
 * - expired：已过期
 * - paused：已暂停
 */
export type SubscriptionStatus =
  | 'active' // 有效
  | 'past_due' // 逾期
  | 'cancelled' // 已取消
  | 'expired' // 已过期
  | 'paused' // 已暂停

/**
 * 订阅层级。
 * - free：免费
 * - pro：Pro
 * - premium：Premium（**预留不售**；对外不展示）
 */
export type SubscriptionTier =
  | 'free' // 免费
  | 'pro' // Pro
  | 'premium' // Premium（预留不售）

/**
 * 订阅记录接口
 */
export interface Subscription {
  /** 订阅 ID (Supabase UUID) */
  id?: string

  /** 用户 ID (Supabase UUID) */
  user_id: string

  /** Gumroad 订阅 ID */
  gumroad_subscription_id?: string | null

  /** Gumroad 订单 ID */
  gumroad_order_id?: string | null

  /** Gumroad 变体 ID (plan_id) */
  gumroad_variant_id?: string | null

  /** 订阅状态 */
  status: SubscriptionStatus

  /** 订阅层级 */
  tier: SubscriptionTier

  /** 当前周期开始时间 (ISO 8601) */
  current_period_start: string

  /** 当前周期结束时间 (ISO 8601) */
  current_period_end: string

  /** 是否在周期结束时取消 */
  cancel_at_period_end?: boolean

  /** 取消时间 (ISO 8601) */
  cancelled_at?: string | null

  /** 创建时间 (ISO 8601) */
  created_at?: string

  /** 更新时间 (ISO 8601) */
  updated_at?: string
}
