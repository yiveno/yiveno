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
 * 投影写入来源（产品文档 §A.3.2）。
 * - gumroad_webhook：Gumroad Ping 入站
 * - gumroad_verify：Refresh / Cron 调 Gumroad API 对账
 * - admin_grant：人工授（生产禁止无审计长期 Pro）
 */
export type SubscriptionSource =
  | 'gumroad_webhook' // Gumroad Ping
  | 'gumroad_verify' // API 对账
  | 'admin_grant' // 人工授

/**
 * 与 Gumroad 对账状态。
 * - verified：已与 Gumroad 对齐
 * - unverified：尚未对账
 * - mismatch：Gumroad 查无或不一致
 * - stale：超过新鲜度阈值待对账
 */
export type SubscriptionVerificationStatus =
  | 'verified' // 已对账
  | 'unverified' // 未对账
  | 'mismatch' // 不一致
  | 'stale' // 过期待对账

/**
 * 订阅记录接口（Supabase 投影；计费真相在 Gumroad）
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

  /** 投影来源 */
  source?: SubscriptionSource | null

  /** 最近一次成功对上 Gumroad 的时间 */
  last_verified_at?: string | null

  /** 对账状态 */
  verification_status?: SubscriptionVerificationStatus | null

  /** Gumroad subscriber.status 缓存（如 alive） */
  gumroad_subscriber_status?: string | null

  /** 创建时间 (ISO 8601) */
  created_at?: string

  /** 更新时间 (ISO 8601) */
  updated_at?: string
}
