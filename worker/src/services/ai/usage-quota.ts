/**
 * 托管 LLM 月度 + 日软盖配额服务（登录 Free / Pro 分档）。
 */

import {
  buildDailyUsageKey,
  buildMonthlyUsageKey,
  resolveHostedDailyCap,
  resolveHostedMonthlyQuota
} from '../../config/ai-hosted'
import type { Env } from '../../types/env'

export interface HostedQuotaSnapshot {
  used: number
  limit: number
  remaining: number
  monthKey: string
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  tier: 'free' | 'pro'
}

/**
 * 读取用户当月/当日配额快照（不递增）
 */
export async function getHostedQuotaSnapshot(
  env: Env,
  userId: string,
  isPro: boolean
): Promise<HostedQuotaSnapshot> {
  const limit = resolveHostedMonthlyQuota(env, isPro)
  const dailyLimit = resolveHostedDailyCap(env, isPro)
  const monthKey = buildMonthlyUsageKey(userId)
  const dayKey = buildDailyUsageKey(userId)
  const kv = env.AI_USAGE_KV
  const monthRaw = kv ? await kv.get(monthKey) : null
  const dayRaw = kv ? await kv.get(dayKey) : null
  const used = Number.parseInt(monthRaw ?? '0', 10) || 0
  const dailyUsed = Number.parseInt(dayRaw ?? '0', 10) || 0

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    monthKey,
    dailyUsed,
    dailyLimit,
    dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
    tier: isPro ? 'pro' : 'free'
  }
}

/**
 * 在月配额与日软盖均允许时递增一次调用计数。
 * 未绑定 AI_USAGE_KV 时拒绝（避免无上限调用）。
 */
export async function consumeHostedQuota(
  env: Env,
  userId: string,
  isPro: boolean
): Promise<
  | { allowed: true; snapshot: HostedQuotaSnapshot }
  | {
      allowed: false
      snapshot: HostedQuotaSnapshot
      reason?: 'quota_exceeded' | 'daily_cap_exceeded' | 'kv_not_configured'
    }
> {
  if (!env.AI_USAGE_KV) {
    const limit = resolveHostedMonthlyQuota(env, isPro)
    const dailyLimit = resolveHostedDailyCap(env, isPro)
    const monthKey = buildMonthlyUsageKey(userId)
    return {
      allowed: false,
      reason: 'kv_not_configured',
      snapshot: {
        used: 0,
        limit,
        remaining: 0,
        monthKey,
        dailyUsed: 0,
        dailyLimit,
        dailyRemaining: 0,
        tier: isPro ? 'pro' : 'free'
      }
    }
  }

  const snapshot = await getHostedQuotaSnapshot(env, userId, isPro)

  if (snapshot.used >= snapshot.limit) {
    return { allowed: false, reason: 'quota_exceeded', snapshot }
  }
  if (snapshot.dailyUsed >= snapshot.dailyLimit) {
    return { allowed: false, reason: 'daily_cap_exceeded', snapshot }
  }

  const nextUsed = snapshot.used + 1
  const nextDailyUsed = snapshot.dailyUsed + 1
  const dayKey = buildDailyUsageKey(userId)
  await env.AI_USAGE_KV.put(snapshot.monthKey, String(nextUsed))
  await env.AI_USAGE_KV.put(dayKey, String(nextDailyUsed), {
    expirationTtl: 60 * 60 * 48
  })

  const updated: HostedQuotaSnapshot = {
    ...snapshot,
    used: nextUsed,
    remaining: Math.max(0, snapshot.limit - nextUsed),
    dailyUsed: nextDailyUsed,
    dailyRemaining: Math.max(0, snapshot.dailyLimit - nextDailyUsed)
  }

  return { allowed: true, snapshot: updated }
}
