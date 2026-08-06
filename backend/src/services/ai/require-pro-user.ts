/**
 * Pro 用户校验（§A.3.2：投影 + 新鲜度 + 对账）
 */

import { getUserSubscription } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { warn } from '../../utils/logger'
import { decideEntitlementFreshness } from '../gumroad/entitlement-policy'
import { reconcileUserSubscription } from '../gumroad/reconcile'
import { isFakeGumroadSubscriptionId } from '../gumroad/subscription-id'

type EnvWithGumroad = Env & {
  GUMROAD_ACCESS_TOKEN?: string
}

/**
 * 判断用户是否为有效 Pro 订阅（同步 / hosted LLM / embed 门禁）。
 */
export async function isActiveProUser(env: Env, userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(env, userId)
  if (!subscription || subscription.tier !== 'pro' || subscription.status !== 'active') {
    return false
  }

  if (subscription.verification_status === 'mismatch') {
    return false
  }

  if (isFakeGumroadSubscriptionId(subscription.gumroad_subscription_id)) {
    return false
  }

  const accessToken = (env as EnvWithGumroad).GUMROAD_ACCESS_TOKEN
  if (!(accessToken || '').trim()) {
    warn('[ProGate] 未配置 GUMROAD_ACCESS_TOKEN，仅用投影门禁（生产须配置）')
    return true
  }

  const freshness = decideEntitlementFreshness({
    verificationStatus: subscription.verification_status,
    lastVerifiedAt: subscription.last_verified_at
  })

  if (freshness === 'fresh') {
    return true
  }
  if (freshness === 'deny') {
    return false
  }

  const outcome = await reconcileUserSubscription(env, userId)
  if (outcome.isPro) {
    return true
  }

  if (outcome.apiFailed) {
    const grace = decideEntitlementFreshness({
      verificationStatus: subscription.verification_status,
      lastVerifiedAt: subscription.last_verified_at,
      apiFailed: true
    })
    return grace === 'grace_ok'
  }

  return false
}
