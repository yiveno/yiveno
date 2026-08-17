/**
 * 订阅状态。
 * - active：有效
 * - past_due：逾期（对应 Dodo on_hold）
 * - cancelled：已取消
 * - expired：已过期
 * - paused：已暂停（保留；Dodo 不用此态）
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
 * - dodo_webhook：Dodo webhook 入站
 * - dodo_verify：Refresh / Cron 调 Dodo API 对账
 * - admin_grant：人工授（生产禁止无审计长期 Pro）
 */
export type SubscriptionSource =
  | 'dodo_webhook' // Dodo webhook
  | 'dodo_verify' // API 对账
  | 'admin_grant' // 人工授

/**
 * 与 Dodo 对账状态。
 * - verified：已与 Dodo 对齐
 * - unverified：尚未对账
 * - mismatch：Dodo 查无或不一致
 * - stale：超过新鲜度阈值待对账
 */
export type SubscriptionVerificationStatus =
  | 'verified' // 已对账
  | 'unverified' // 未对账
  | 'mismatch' // 不一致
  | 'stale' // 过期待对账

/**
 * 订阅记录接口（Supabase 投影；计费真相在 Dodo）
 */
export interface Subscription {
  /** 订阅 ID (Supabase UUID) */
  id?: string

  /** 用户 ID (Supabase UUID) */
  user_id: string

  /** Dodo subscription ID（`sub_…`） */
  provider_subscription_id?: string | null

  /** 最近一笔 Dodo payment ID（`pay_…`） */
  provider_transaction_id?: string | null

  /** Dodo product ID（`pdt_…`） */
  provider_price_id?: string | null

  /** Dodo customer ID（`cus_…`） */
  provider_customer_id?: string | null

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

  /** 最近一次成功对上 Dodo 的时间 */
  last_verified_at?: string | null

  /** 对账状态 */
  verification_status?: SubscriptionVerificationStatus | null

  /** Dodo subscription.status 缓存（如 active） */
  provider_status?: string | null

  /** 创建时间 (ISO 8601) */
  created_at?: string

  /** 更新时间 (ISO 8601) */
  updated_at?: string
}
