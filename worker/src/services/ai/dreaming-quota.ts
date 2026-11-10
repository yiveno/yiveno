/**
 * Dreaming 独立调用配额（与托管 Clue LLM 分桶，保护 Capture enrichment / Recall）。
 * peek-then-commit：先探额，成功后再扣。
 */

import type { Env } from '../../types/env'

/** Free：每日 dreaming 调用上限。 */
export const AI_DREAMING_FREE_DAILY_CAP = 5
/** Free：每月 dreaming 调用上限。 */
export const AI_DREAMING_FREE_MONTHLY_QUOTA = 20
/** Pro：每日 dreaming 调用上限。 */
export const AI_DREAMING_PRO_DAILY_CAP = 30
/** Pro：每月 dreaming 调用上限。 */
export const AI_DREAMING_PRO_MONTHLY_QUOTA = 300

export type DreamingQuotaSnapshot = {
  used: number
  limit: number
  remaining: number
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthKey: string
  dayKey: string
  tier: 'free' | 'pro'
}

function utcMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function utcDayKey(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function resolveDreamingMonthlyQuota(env: Env, isPro: boolean): number {
  if (isPro) {
    return parsePositiveInt(env.AI_DREAMING_PRO_MONTHLY_QUOTA, AI_DREAMING_PRO_MONTHLY_QUOTA)
  }
  return parsePositiveInt(env.AI_DREAMING_FREE_MONTHLY_QUOTA, AI_DREAMING_FREE_MONTHLY_QUOTA)
}

export function resolveDreamingDailyCap(env: Env, isPro: boolean): number {
  if (isPro) {
    return parsePositiveInt(env.AI_DREAMING_PRO_DAILY_CAP, AI_DREAMING_PRO_DAILY_CAP)
  }
  return parsePositiveInt(env.AI_DREAMING_FREE_DAILY_CAP, AI_DREAMING_FREE_DAILY_CAP)
}

function buildMonthKey(userId: string): string {
  return `dreaming_ai:${userId}:m:${utcMonthKey()}`
}

function buildDayKey(userId: string): string {
  return `dreaming_ai:${userId}:d:${utcDayKey()}`
}

export async function getDreamingQuotaSnapshot(
  env: Env,
  userId: string,
  isPro: boolean
): Promise<DreamingQuotaSnapshot> {
  const limit = resolveDreamingMonthlyQuota(env, isPro)
  const dailyLimit = resolveDreamingDailyCap(env, isPro)
  const monthKey = buildMonthKey(userId)
  const dayKey = buildDayKey(userId)
  const kv = env.AI_USAGE_KV
  const monthRaw = kv ? await kv.get(monthKey) : null
  const dayRaw = kv ? await kv.get(dayKey) : null
  const used = Number.parseInt(monthRaw ?? '0', 10) || 0
  const dailyUsed = Number.parseInt(dayRaw ?? '0', 10) || 0
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    dailyUsed,
    dailyLimit,
    dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
    monthKey,
    dayKey,
    tier: isPro ? 'pro' : 'free'
  }
}

/** 只读探额：不写 KV。 */
export async function peekDreamingQuota(
  env: Env,
  userId: string,
  isPro: boolean
): Promise<
  | { allowed: true; snapshot: DreamingQuotaSnapshot }
  | {
      allowed: false
      snapshot: DreamingQuotaSnapshot
      reason: 'quota_exceeded' | 'daily_cap_exceeded' | 'kv_not_configured'
    }
> {
  if (!env.AI_USAGE_KV) {
    const snapshot = await getDreamingQuotaSnapshot(env, userId, isPro)
    return {
      allowed: false,
      reason: 'kv_not_configured',
      snapshot: { ...snapshot, remaining: 0, dailyRemaining: 0 }
    }
  }
  const snapshot = await getDreamingQuotaSnapshot(env, userId, isPro)
  if (snapshot.used >= snapshot.limit) {
    return { allowed: false, reason: 'quota_exceeded', snapshot }
  }
  if (snapshot.dailyUsed >= snapshot.dailyLimit) {
    return { allowed: false, reason: 'daily_cap_exceeded', snapshot }
  }
  return { allowed: true, snapshot }
}

/** 成功后扣 1 次（按 peek 时的 used 递增）。 */
export async function commitDreamingQuota(
  env: Env,
  peeked: DreamingQuotaSnapshot
): Promise<DreamingQuotaSnapshot> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return peeked
  }
  const nextUsed = peeked.used + 1
  const nextDailyUsed = peeked.dailyUsed + 1
  await kv.put(peeked.monthKey, String(nextUsed))
  await kv.put(peeked.dayKey, String(nextDailyUsed), { expirationTtl: 60 * 60 * 48 })
  return {
    ...peeked,
    used: nextUsed,
    remaining: Math.max(0, peeked.limit - nextUsed),
    dailyUsed: nextDailyUsed,
    dailyRemaining: Math.max(0, peeked.dailyLimit - nextDailyUsed)
  }
}
