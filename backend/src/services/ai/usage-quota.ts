/**
 * Pro 托管 LLM 月度配额服务
 */

import { buildMonthlyUsageKey, resolveHostedMonthlyQuota } from '../../config/ai-hosted'
import type { Env } from '../../types/env'

export interface HostedQuotaSnapshot {
  used: number
  limit: number
  remaining: number
  monthKey: string
}

/**
 * 读取用户当月配额快照（不递增）
 */
export async function getHostedQuotaSnapshot(
  env: Env,
  userId: string
): Promise<HostedQuotaSnapshot> {
  const limit = resolveHostedMonthlyQuota(env)
  const monthKey = buildMonthlyUsageKey(userId)
  const raw = env.AI_USAGE_KV ? await env.AI_USAGE_KV.get(monthKey) : null
  const used = Number.parseInt(raw ?? '0', 10) || 0

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    monthKey
  }
}

/**
 * 在配额允许时递增一次调用计数
 */
export async function consumeHostedQuota(
  env: Env,
  userId: string
): Promise<
  | { allowed: true; snapshot: HostedQuotaSnapshot }
  | { allowed: false; snapshot: HostedQuotaSnapshot }
> {
  const snapshot = await getHostedQuotaSnapshot(env, userId)

  if (!env.AI_USAGE_KV) {
    return { allowed: true, snapshot }
  }

  if (snapshot.used >= snapshot.limit) {
    return { allowed: false, snapshot }
  }

  const nextUsed = snapshot.used + 1
  await env.AI_USAGE_KV.put(snapshot.monthKey, String(nextUsed))

  const updated: HostedQuotaSnapshot = {
    ...snapshot,
    used: nextUsed,
    remaining: Math.max(0, snapshot.limit - nextUsed)
  }

  return { allowed: true, snapshot: updated }
}
