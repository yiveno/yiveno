/**
 * Pro 用户校验
 */

import { getUserSubscription } from '../../data-access/supabase'
import type { Env } from '../../types/env'

/**
 * 判断用户是否为有效 Pro 订阅
 */
export async function isActiveProUser(env: Env, userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(env, userId)
  return subscription?.tier === 'pro' && subscription.status === 'active'
}
