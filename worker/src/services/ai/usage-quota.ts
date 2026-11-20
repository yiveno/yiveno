/**
 * 托管 LLM 配额服务：Free/Pro 月度+日盖；匿名终身档（无月重置、无日盖）。
 */

import {
  buildDailyUsageKey,
  buildLifetimeUsageKey,
  buildMonthlyUsageKey,
  resolveHostedAnonymousLifetimeQuota,
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
  tier: 'free' | 'pro' | 'anonymous'
}

export type HostedQuotaOptions = {
  /** 必须在 isPro 之前短路；匿名走终身 key */
  isAnonymous?: boolean
  isPro: boolean
}

function anonymousSnapshot(env: Env, used: number): HostedQuotaSnapshot {
  const limit = resolveHostedAnonymousLifetimeQuota(env)
  const remaining = Math.max(0, limit - used)
  return {
    used,
    limit,
    remaining,
    monthKey: 'lifetime',
    // 429 契约：匿名档 daily* 镜像终身数
    dailyUsed: used,
    dailyLimit: limit,
    dailyRemaining: remaining,
    tier: 'anonymous'
  }
}

/**
 * 读取配额快照（不递增）。
 * 匿名分支必须在 isPro 判断之前短路。
 */
export async function getHostedQuotaSnapshot(
  env: Env,
  userId: string,
  isProOrOptions: boolean | HostedQuotaOptions
): Promise<HostedQuotaSnapshot> {
  const opts: HostedQuotaOptions =
    typeof isProOrOptions === 'boolean'
      ? { isPro: isProOrOptions, isAnonymous: false }
      : isProOrOptions

  if (opts.isAnonymous) {
    const kv = env.AI_USAGE_KV
    const key = buildLifetimeUsageKey(userId)
    const raw = kv ? await kv.get(key) : null
    const used = Number.parseInt(raw ?? '0', 10) || 0
    return anonymousSnapshot(env, used)
  }

  const isPro = opts.isPro
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
 * 在配额允许时递增一次调用计数。
 * 未绑定 AI_USAGE_KV 时拒绝（避免无上限调用）。
 */
export async function consumeHostedQuota(
  env: Env,
  userId: string,
  isProOrOptions: boolean | HostedQuotaOptions
): Promise<
  | { allowed: true; snapshot: HostedQuotaSnapshot }
  | {
      allowed: false
      snapshot: HostedQuotaSnapshot
      reason?: 'quota_exceeded' | 'daily_cap_exceeded' | 'kv_not_configured'
    }
> {
  const opts: HostedQuotaOptions =
    typeof isProOrOptions === 'boolean'
      ? { isPro: isProOrOptions, isAnonymous: false }
      : isProOrOptions

  if (!env.AI_USAGE_KV) {
    if (opts.isAnonymous) {
      const snapshot = anonymousSnapshot(env, 0)
      return {
        allowed: false,
        reason: 'kv_not_configured',
        snapshot: { ...snapshot, remaining: 0, dailyRemaining: 0 }
      }
    }
    const limit = resolveHostedMonthlyQuota(env, opts.isPro)
    const dailyLimit = resolveHostedDailyCap(env, opts.isPro)
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
        tier: opts.isPro ? 'pro' : 'free'
      }
    }
  }

  if (opts.isAnonymous) {
    const snapshot = await getHostedQuotaSnapshot(env, userId, opts)
    if (snapshot.used >= snapshot.limit) {
      return { allowed: false, reason: 'quota_exceeded', snapshot }
    }
    const nextUsed = snapshot.used + 1
    await env.AI_USAGE_KV.put(buildLifetimeUsageKey(userId), String(nextUsed))
    const updated = anonymousSnapshot(env, nextUsed)
    return { allowed: true, snapshot: updated }
  }

  const snapshot = await getHostedQuotaSnapshot(env, userId, opts)

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
