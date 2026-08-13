/**
 * GET /api/subscription — 扩展用 Supabase Bearer 查询当前用户是否 Pro。
 * 默认强制与 Paddle 对账（§A.3.2 Refresh）。
 */

import { getUserSubscription } from '../data-access/supabase'
import { isActiveProUser } from '../services/ai/require-pro-user'
import { reconcileUserSubscription } from '../services/billing/reconcile'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'
import type { Subscription } from '@yiveno/types'

export type SubscriptionStatusPayload = {
  isPro: boolean
  tier: Subscription['tier'] | 'free'
  status: Subscription['status'] | 'inactive'
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

/**
 * 将订阅行映射为扩展可读快照（未登录/无订阅 → free）。
 */
export function toSubscriptionStatusPayload(
  subscription: Subscription | null,
  isPro: boolean
): SubscriptionStatusPayload {
  if (!subscription || !isPro) {
    return {
      isPro: false,
      tier: 'free',
      status: subscription?.status === 'expired' ? 'expired' : 'inactive',
      currentPeriodEnd: subscription?.current_period_end ?? null,
      cancelAtPeriodEnd: false
    }
  }
  return {
    isPro: true,
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false
  }
}

/**
 * 查询当前用户订阅快照。
 * @param reconcile 默认 true：Refresh / 账户页须对账
 */
export async function handleGetSubscriptionStatus(
  env: Env,
  userId: string,
  options?: { reconcile?: boolean }
): Promise<SubscriptionStatusPayload> {
  const shouldReconcile = options?.reconcile !== false

  if (shouldReconcile) {
    const outcome = await reconcileUserSubscription(env, userId)
    info('[Subscription] 已对账', {
      userId,
      isPro: outcome.isPro,
      reason: outcome.reason,
      apiFailed: outcome.apiFailed
    })
  }

  const subscription = await getUserSubscription(env, userId)
  const isPro = await isActiveProUser(env, userId)
  return toSubscriptionStatusPayload(subscription, isPro)
}

/** 包装：失败时打日志并抛出稳定错误码。 */
export async function getSubscriptionStatusOrThrow(
  env: Env,
  userId: string,
  options?: { reconcile?: boolean }
): Promise<SubscriptionStatusPayload> {
  try {
    return await handleGetSubscriptionStatus(env, userId, options)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Subscription] 查询失败', { detail: msg, userId })
    throw new Error('subscription_status_failed')
  }
}
