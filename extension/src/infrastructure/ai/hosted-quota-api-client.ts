/**
 * 托管 Clue LLM 配额客户端（Background 调 Worker `GET /api/ai/hosted/quota`）。
 */

import { parseWorkerErrorResponse } from '@/infrastructure/ai/worker-api-error'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

/** 与 Worker `handleHostedQuota` 响应对齐。 */
export type HostedQuotaSnapshot = {
  model: string
  tier: 'free' | 'pro' | 'anonymous'
  used: number
  limit: number
  remaining: number
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthKey: string
  /** 匿名试用 embedding 终身计数（正式档通常缺省） */
  embedUsed?: number
  embedLimit?: number
  embedRemaining?: number
}

function isOptionalNonNegNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

/** 供单测与解析共用。 */
export function isHostedQuotaSnapshot(body: unknown): body is HostedQuotaSnapshot {
  if (typeof body !== 'object' || body === null) {
    return false
  }
  const record = body as Record<string, unknown>
  const tierOk = record.tier === 'free' || record.tier === 'pro' || record.tier === 'anonymous'
  if (!(
    typeof record.model === 'string' &&
    tierOk &&
    typeof record.used === 'number' &&
    typeof record.limit === 'number' &&
    typeof record.remaining === 'number' &&
    typeof record.dailyUsed === 'number' &&
    typeof record.dailyLimit === 'number' &&
    typeof record.dailyRemaining === 'number' &&
    typeof record.monthKey === 'string' &&
    isOptionalNonNegNumber(record.embedUsed) &&
    isOptionalNonNegNumber(record.embedLimit) &&
    isOptionalNonNegNumber(record.embedRemaining)
  )) {
    return false
  }
  // 匿名契约：monthKey=lifetime；daily* 镜像终身（W1'）
  if (record.tier === 'anonymous' && record.monthKey !== 'lifetime') {
    return false
  }
  return true
}

/**
 * GET /api/ai/hosted/quota — 须登录 Bearer（device token 或迁移窗 access）。
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
      throw parseWorkerErrorResponse(response, body)
    }
    if (!isHostedQuotaSnapshot(body)) {
      throw new Error('invalid_hosted_quota_response')
    }
    flowOk('ClueLlm', '读取托管配额', startedAt, {
      tier: body.tier,
      used: body.used,
      limit: body.limit,
      dailyUsed: body.dailyUsed,
      dailyLimit: body.dailyLimit,
      ...(body.embedRemaining !== undefined ? { embedRemaining: body.embedRemaining } : {})
    })
    return body
  } catch (error) {
    flowFail('ClueLlm', '读取托管配额', startedAt, error)
    throw error
  }
}
