/**
 * 托管 LLM 配额服务：Free/Pro 月度+日盖；匿名终身档（无月重置、无日盖）。
 * peek-then-commit：先探额，成功后再扣。
 * 测试账号可通过 AI_HOSTED_QUOTA_EXEMPT_USER_IDS 豁免拒绝（仍计数）。
 */

import {
  buildDailyUsageKey,
  buildLifetimeUsageKey,
  buildMonthlyUsageKey,
  isQuotaExemptUser,
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

type HostedQuotaDeniedReason = 'quota_exceeded' | 'daily_cap_exceeded' | 'kv_not_configured'

function anonymousSnapshot(env: Env, userId: string, used: number): HostedQuotaSnapshot {
  const limit = isQuotaExemptUser(env, userId)
    ? Number.MAX_SAFE_INTEGER
    : resolveHostedAnonymousLifetimeQuota(env)
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

function resolveOpts(isProOrOptions: boolean | HostedQuotaOptions): HostedQuotaOptions {
  return typeof isProOrOptions === 'boolean'
    ? { isPro: isProOrOptions, isAnonymous: false }
    : isProOrOptions
}

/**
 * 读取配额快照（不递增）。
 * 匿名分支必须在 isPro 判断之前短路。
 * 豁免账号：limit/dailyLimit 展示为 Number.MAX_SAFE_INTEGER；used 仍为真实计数。
 */
export async function getHostedQuotaSnapshot(
  env: Env,
  userId: string,
  isProOrOptions: boolean | HostedQuotaOptions
): Promise<HostedQuotaSnapshot> {
  const opts = resolveOpts(isProOrOptions)

  if (opts.isAnonymous) {
    const kv = env.AI_USAGE_KV
    const key = buildLifetimeUsageKey(userId)
    const raw = kv ? await kv.get(key) : null
    const used = Number.parseInt(raw ?? '0', 10) || 0
    return anonymousSnapshot(env, userId, used)
  }

  const isPro = opts.isPro
  const exempt = isQuotaExemptUser(env, userId)
  const limit = exempt ? Number.MAX_SAFE_INTEGER : resolveHostedMonthlyQuota(env, isPro)
  const dailyLimit = exempt ? Number.MAX_SAFE_INTEGER : resolveHostedDailyCap(env, isPro)
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

function kvMissingSnapshot(
  env: Env,
  userId: string,
  opts: HostedQuotaOptions
): HostedQuotaSnapshot {
  if (opts.isAnonymous) {
    const snapshot = anonymousSnapshot(env, userId, 0)
    return { ...snapshot, remaining: 0, dailyRemaining: 0 }
  }
  const limit = resolveHostedMonthlyQuota(env, opts.isPro)
  const dailyLimit = resolveHostedDailyCap(env, opts.isPro)
  return {
    used: 0,
    limit,
    remaining: 0,
    monthKey: buildMonthlyUsageKey(userId),
    dailyUsed: 0,
    dailyLimit,
    dailyRemaining: 0,
    tier: opts.isPro ? 'pro' : 'free'
  }
}

/**
 * 只读探额：不写 KV。
 * 未绑定 AI_USAGE_KV 时拒绝（避免无上限调用）；豁免不绕过 kv_not_configured。
 * 豁免账号跳过 quota_exceeded / daily_cap_exceeded，仍允许后续 commit 计数。
 */
export async function peekHostedQuota(
  env: Env,
  userId: string,
  isProOrOptions: boolean | HostedQuotaOptions
): Promise<
  | { allowed: true; snapshot: HostedQuotaSnapshot }
  | {
      allowed: false
      snapshot: HostedQuotaSnapshot
      reason: HostedQuotaDeniedReason
    }
> {
  const opts = resolveOpts(isProOrOptions)

  if (!env.AI_USAGE_KV) {
    return {
      allowed: false,
      reason: 'kv_not_configured',
      snapshot: kvMissingSnapshot(env, userId, opts)
    }
  }

  const exempt = isQuotaExemptUser(env, userId)
  const snapshot = await getHostedQuotaSnapshot(env, userId, opts)

  if (opts.isAnonymous) {
    if (!exempt && snapshot.used >= snapshot.limit) {
      return { allowed: false, reason: 'quota_exceeded', snapshot }
    }
    return { allowed: true, snapshot }
  }

  if (!exempt && snapshot.used >= snapshot.limit) {
    return { allowed: false, reason: 'quota_exceeded', snapshot }
  }
  if (!exempt && snapshot.dailyUsed >= snapshot.dailyLimit) {
    return { allowed: false, reason: 'daily_cap_exceeded', snapshot }
  }

  return { allowed: true, snapshot }
}

/**
 * 成功后扣 1 次（按 peek 时的 used 递增）。
 * 豁免账号照常计数，永不因配额拒绝（拒绝只发生在 peek）。
 */
export async function commitHostedQuota(
  env: Env,
  userId: string,
  peeked: HostedQuotaSnapshot,
  isProOrOptions: boolean | HostedQuotaOptions
): Promise<HostedQuotaSnapshot> {
  const opts = resolveOpts(isProOrOptions)
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return peeked
  }

  if (opts.isAnonymous || peeked.tier === 'anonymous') {
    const nextUsed = peeked.used + 1
    await kv.put(buildLifetimeUsageKey(userId), String(nextUsed))
    return anonymousSnapshot(env, userId, nextUsed)
  }

  const nextUsed = peeked.used + 1
  const nextDailyUsed = peeked.dailyUsed + 1
  const dayKey = buildDailyUsageKey(userId)
  await kv.put(peeked.monthKey, String(nextUsed))
  await kv.put(dayKey, String(nextDailyUsed), {
    expirationTtl: 60 * 60 * 48
  })

  return {
    ...peeked,
    used: nextUsed,
    remaining: Math.max(0, peeked.limit - nextUsed),
    dailyUsed: nextDailyUsed,
    dailyRemaining: Math.max(0, peeked.dailyLimit - nextDailyUsed)
  }
}
