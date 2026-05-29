// packages/types/src/db.ts

export interface Subscription {
  id?: string
  user_id: string
  gumroad_subscription_id: string
  gumroad_order_id: string | null
  gumroad_variant_id: string | null
  status: 'active' | 'past_due' | 'expired' | 'cancelled' | 'unpaid'
  tier: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  cancelled_at: string | null
  updated_at?: string
}

export interface PaymentRecord {
  id?: string
  user_id: string
  subscription_id: string | null
  gumroad_order_id: string | null
  gumroad_payment_id: string | null
  amount: number
  currency: string
  status: string
  payment_method: string | null
  event_type: string
  metadata: Record<string, any> | null
}
