/**
 * 托管 Clue LLM 配额客户端（Background 调 Worker `GET /api/ai/hosted/quota`）。
 */

import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

/** 与 Worker `handleHostedQuota` 响应对齐。 */
export type HostedQuotaSnapshot = {
  model: string
  tier: 'free' | 'pro'
  used: number
  limit: number
  remaining: number
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthKey: string
}

function isHostedQuotaSnapshot(body: unknown): body is HostedQuotaSnapshot {
  if (typeof body !== 'object' || body === null) {
    return false
  }
  const record = body as Record<string, unknown>
  return (
    typeof record.model === 'string' &&
    (record.tier === 'free' || record.tier === 'pro') &&
    typeof record.used === 'number' &&
    typeof record.limit === 'number' &&
    typeof record.remaining === 'number' &&
    typeof record.dailyUsed === 'number' &&
    typeof record.dailyLimit === 'number' &&
    typeof record.dailyRemaining === 'number' &&
    typeof record.monthKey === 'string'
  )
}

/**
 * GET /api/ai/hosted/quota — 须登录 Bearer。
 */
export async function fetchHostedQuota(accessToken: string): Promise<HostedQuotaSnapshot> {
  const startedAt = flowStart('ClueLlm', '读取托管配额')
  try {
    const url = `${getApiBaseUrl()}/api/ai/hosted/quota`
    const response = await fetch(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` }
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const errorCode =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `http_${response.status}`
      throw new Error(errorCode)
    }
    if (!isHostedQuotaSnapshot(body)) {
      throw new Error('invalid_hosted_quota_response')
    }
    flowOk('ClueLlm', '读取托管配额', startedAt, {
      tier: body.tier,
      used: body.used,
      limit: body.limit,
      dailyUsed: body.dailyUsed,
      dailyLimit: body.dailyLimit
    })
    return body
  } catch (error) {
    flowFail('ClueLlm', '读取托管配额', startedAt, error)
    throw error
  }
}
