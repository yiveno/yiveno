/**
 * 支付状态类型
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

/**
 * 支付记录接口
 */
export interface PaymentRecord {
  /** 支付记录 ID (Supabase UUID) */
  id?: string

  /** 用户 ID (Supabase UUID) */
  user_id: string

  /** Gumroad 订阅 ID */
  gumroad_subscription_id?: string | null

  /** Gumroad 订单 ID */
  gumroad_order_id: string | null

  /** Gumroad 支付 ID */
  gumroad_payment_id?: string | null

  /** 支付金额（单位：分） */
  amount: number

  /** 货币代码 (ISO 4217) */
  currency: string

  /** 支付状态 */
  status: PaymentStatus

  /** 支付方式 */
  payment_method?: string | null

  /** 事件类型 (Gumroad webhook notification_type) */
  event_type: string

  /** 元数据 (JSON) */
  metadata?: Record<string, unknown> | null

  /** 创建时间 (ISO 8601) */
  created_at?: string
}
