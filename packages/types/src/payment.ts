/**
 * 支付状态。
 * - pending：待支付
 * - paid：已支付
 * - failed：失败
 * - refunded：已退款
 */
export type PaymentStatus =
  | 'pending' // 待支付
  | 'paid' // 已支付
  | 'failed' // 失败
  | 'refunded' // 已退款

/**
 * 支付记录接口
 */
export interface PaymentRecord {
  /** 支付记录 ID (Supabase UUID) */
  id?: string

  /** 用户 ID (Supabase UUID) */
  user_id: string

  /** Paddle subscription ID */
  provider_subscription_id?: string | null

  /** Paddle transaction ID */
  provider_transaction_id: string | null

  /** Paddle payment / adjustment ID */
  provider_payment_id?: string | null

  /** 支付金额（最小货币单位，如美分） */
  amount: number

  /** 货币代码 (ISO 4217) */
  currency: string

  /** 支付状态 */
  status: PaymentStatus

  /** 支付方式 */
  payment_method?: string | null

  /** 事件类型 (Paddle event_type) */
  event_type: string

  /** 元数据 (JSON；禁止存卡号/密钥) */
  metadata?: Record<string, unknown> | null

  /** 创建时间 (ISO 8601) */
  created_at?: string
}
