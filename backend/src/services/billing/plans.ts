/**
 * Yiveno 计费套餐目录（展示锚点的唯一代码源）。
 * 结账权威在 Paddle Price；客户端只传 plan id。
 */

import type { Env } from '../../types/env'

/** 可结账的套餐。 */
export type BillingPlanId =
  | 'pro_monthly' // 标准月付
  | 'pro_annual' // 标准年付
  | 'founding_monthly' // Founding 月付（实验）
  | 'founding_annual' // Founding 年付（实验）

export type BillingPlanPublic = {
  id: BillingPlanId
  /** 对外展示金额（美元，不含 $） */
  displayUsd: string
  /** month：按月 · year：按年 */
  interval: 'month' | 'year'
  /** standard：标准价 · founding：早期实验价 */
  kind: 'standard' | 'founding'
}

const STANDARD_PLANS: readonly BillingPlanPublic[] = [
  { id: 'pro_monthly', displayUsd: '7.99', interval: 'month', kind: 'standard' },
  { id: 'pro_annual', displayUsd: '59.99', interval: 'year', kind: 'standard' }
]

const FOUNDING_PLANS: readonly BillingPlanPublic[] = [
  { id: 'founding_monthly', displayUsd: '5.99', interval: 'month', kind: 'founding' },
  { id: 'founding_annual', displayUsd: '49.99', interval: 'year', kind: 'founding' }
]

function foundingEnabled(env: Env): boolean {
  return (env.BILLING_FOUNDING_ENABLED || '').trim().toLowerCase() === 'true'
}

/** 当前可售套餐（Founding 仅开关打开时出现）。 */
export function listPublicPlans(env: Env): BillingPlanPublic[] {
  if (foundingEnabled(env)) {
    return [...STANDARD_PLANS, ...FOUNDING_PLANS]
  }
  return [...STANDARD_PLANS]
}

/** 解析客户端 plan；未开放的 founding 视为无效。 */
export function parseBillingPlanId(raw: unknown, env: Env): BillingPlanId | null {
  if (typeof raw !== 'string') return null
  const allowed = new Set(listPublicPlans(env).map(plan => plan.id))
  if (!allowed.has(raw as BillingPlanId)) return null
  return raw as BillingPlanId
}

/** 套餐 → Paddle Price ID（来自 Worker env）。 */
export function resolvePaddlePriceId(env: Env, planId: BillingPlanId): string | null {
  const map: Record<BillingPlanId, string | undefined> = {
    pro_monthly: env.PADDLE_PRICE_ID_PRO_MONTHLY,
    pro_annual: env.PADDLE_PRICE_ID_PRO_ANNUAL,
    founding_monthly: env.PADDLE_PRICE_ID_FOUNDING_MONTHLY,
    founding_annual: env.PADDLE_PRICE_ID_FOUNDING_ANNUAL
  }
  const value = (map[planId] || '').trim()
  return value || null
}
