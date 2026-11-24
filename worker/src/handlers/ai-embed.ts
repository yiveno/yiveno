/**
 * 登录可用：Workers AI embedding（bge-m3）。
 * 鉴权：双栈 Bearer（device token 或 Supabase）；按用户日/终身配额防刷。
 */

import type { Env } from '../types/env'
import { isActiveProUser } from '../services/ai/require-pro-user'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

export const EMBEDDING_MODEL = '@cf/baai/bge-m3'
const MAX_BATCH = 8
/** 约 512 token 量级的字符截断（粗估）。 */
const MAX_CHARS_PER_TEXT = 2000
/** 登录 Free 默认日调用上限 */
const DEFAULT_FREE_DAILY_LIMIT = 100
/** Pro 默认日调用上限 */
const DEFAULT_PRO_DAILY_LIMIT = 500
/** 匿名终身调用上限（次数，非条数） */
const DEFAULT_ANON_LIFETIME_LIMIT = 30

export function buildAnonymousEmbedUsageKey(userId: string): string {
  return `embed_anon:${userId}`
}

export interface EmbedRequestBody {
  texts?: unknown
}

function utcDayKey(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeTexts(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const texts = raw
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, MAX_CHARS_PER_TEXT))
    .filter(Boolean)
  if (texts.length === 0 || texts.length > MAX_BATCH) {
    return null
  }
  return texts
}

type EmbedQuotaOk = {
  allowed: true
  used: number
  limit: number
  remaining: number
  tier: 'free' | 'pro' | 'anonymous'
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  degraded?: true
}

type EmbedQuotaDenied = {
  allowed: false
  used: number
  limit: number
  remaining: number
  tier: 'free' | 'pro' | 'anonymous'
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  reason: 'quota_exceeded' | 'kv_not_configured'
}

function resolveAnonEmbedLimit(env: Env): number {
  const parsed = Number.parseInt(env.AI_EMBED_ANONYMOUS_LIFETIME_LIMIT ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ANON_LIFETIME_LIMIT
}

/** 匿名 embedding 终身配额快照（只读；供 hosted/quota 展示）。 */
export async function peekAnonymousEmbedQuota(
  env: Env,
  userId: string
): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = resolveAnonEmbedLimit(env)
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { used: 0, limit, remaining: limit }
  }
  try {
    const raw = await kv.get(buildAnonymousEmbedUsageKey(userId))
    const used = raw ? Number.parseInt(raw, 10) || 0 : 0
    return { used, limit, remaining: Math.max(0, limit - used) }
  } catch {
    return { used: 0, limit, remaining: limit }
  }
}

async function consumeEmbedAnonymousQuota(
  env: Env,
  userId: string
): Promise<EmbedQuotaOk | EmbedQuotaDenied> {
  const limit = resolveAnonEmbedLimit(env)
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return {
      allowed: false,
      used: 0,
      limit,
      remaining: 0,
      tier: 'anonymous',
      dailyUsed: 0,
      dailyLimit: limit,
      dailyRemaining: 0,
      reason: 'kv_not_configured'
    }
  }
  const key = buildAnonymousEmbedUsageKey(userId)
  try {
    const raw = await kv.get(key)
    const used = raw ? Number.parseInt(raw, 10) || 0 : 0
    if (used >= limit) {
      return {
        allowed: false,
        used,
        limit,
        remaining: 0,
        tier: 'anonymous',
        dailyUsed: used,
        dailyLimit: limit,
        dailyRemaining: 0,
        reason: 'quota_exceeded'
      }
    }
    const next = used + 1
    await kv.put(key, String(next))
    const remaining = Math.max(0, limit - next)
    return {
      allowed: true,
      used: next,
      limit,
      remaining,
      tier: 'anonymous',
      dailyUsed: next,
      dailyLimit: limit,
      dailyRemaining: remaining
    }
  } catch (err) {
    logError(err, { path: '/api/ai/embed', userId })
    return {
      allowed: true,
      used: 0,
      limit,
      remaining: limit,
      tier: 'anonymous',
      dailyUsed: 0,
      dailyLimit: limit,
      dailyRemaining: limit,
      degraded: true
    }
  }
}

async function consumeEmbedDailyQuota(
  env: Env,
  userId: string,
  isPro: boolean
): Promise<EmbedQuotaOk | EmbedQuotaDenied> {
  const envKey = isPro ? env.AI_EMBED_DAILY_LIMIT : env.AI_EMBED_FREE_DAILY_LIMIT
  const fallback = isPro ? DEFAULT_PRO_DAILY_LIMIT : DEFAULT_FREE_DAILY_LIMIT
  const parsed = Number.parseInt(envKey ?? '', 10)
  const dailyLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  const tier = isPro ? ('pro' as const) : ('free' as const)
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return {
      allowed: false,
      used: 0,
      limit: dailyLimit,
      remaining: 0,
      tier,
      dailyUsed: 0,
      dailyLimit,
      dailyRemaining: 0,
      reason: 'kv_not_configured'
    }
  }

  const key = `embed_ai:${userId}:${utcDayKey()}`
  // 配额是防刷守卫，不是核心操作：KV 读写故障（含同 key 写限流）时 fail-open
  try {
    const raw = await kv.get(key)
    const used = raw ? Number.parseInt(raw, 10) || 0 : 0
    if (used >= dailyLimit) {
      return {
        allowed: false,
        used,
        limit: dailyLimit,
        remaining: 0,
        tier,
        dailyUsed: used,
        dailyLimit,
        dailyRemaining: 0,
        reason: 'quota_exceeded'
      }
    }

    const next = used + 1
    await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 })
    const remaining = Math.max(0, dailyLimit - next)
    return {
      allowed: true,
      used: next,
      limit: dailyLimit,
      remaining,
      tier,
      dailyUsed: next,
      dailyLimit,
      dailyRemaining: remaining
    }
  } catch (err) {
    logError(err, { path: '/api/ai/embed', userId })
    return {
      allowed: true,
      used: 0,
      limit: dailyLimit,
      remaining: dailyLimit,
      tier,
      dailyUsed: 0,
      dailyLimit,
      dailyRemaining: dailyLimit,
      degraded: true
    }
  }
}

type AiEmbeddingResponse = {
  data?: number[][]
  shape?: number[]
}

/**
 * 从 bge-m3 Workers AI 响应中抽出向量列表（`data: number[][]`）。
 */
export function extractEmbeddingsFromAiResponse(
  payload: unknown,
  expectedCount: number
): number[][] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('invalid_ai_embedding_response')
  }
  const body = payload as AiEmbeddingResponse
  const data = body.data
  if (!Array.isArray(data) || data.length < expectedCount) {
    throw new Error('invalid_ai_embedding_response')
  }
  return data.slice(0, expectedCount).map(entry => {
    // 空向量留给 handleEmbed 的 dim==0 → empty_embedding；此处只拒非数组
    if (!Array.isArray(entry)) {
      throw new Error('invalid_ai_embedding_response')
    }
    return entry.map(Number)
  })
}

/**
 * POST /api/ai/embed
 * @param isAnonymous 匿名走终身 embed_anon:{userId}；保留 fail-open
 */
export async function handleEmbed(
  request: Request,
  env: Env,
  userId: string,
  isAnonymous = false
): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()

  if (!env.AI) {
    logInfo('embed_rejected', { reason: 'ai_binding_missing', userId })
    return errorJson({ error: 'ai_binding_missing' }, 503, origin)
  }

  const quota = isAnonymous
    ? await consumeEmbedAnonymousQuota(env, userId)
    : await consumeEmbedDailyQuota(env, userId, await isActiveProUser(env, userId))
  if (!quota.allowed) {
    logInfo('embed_rejected', {
      reason: quota.reason,
      userId,
      used: quota.used,
      limit: quota.limit,
      tier: quota.tier
    })
    const status = quota.reason === 'kv_not_configured' ? 503 : 429
    return errorJson(
      {
        error: quota.reason,
        tier: quota.tier,
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        dailyUsed: quota.dailyUsed,
        dailyLimit: quota.dailyLimit,
        dailyRemaining: quota.dailyRemaining,
        quota: { used: quota.used, limit: quota.limit }
      },
      status,
      origin
    )
  }

  let body: EmbedRequestBody = {}
  try {
    body = (await request.json()) as EmbedRequestBody
  } catch {
    return errorJson({ error: 'invalid_json' }, 400, origin)
  }

  const texts = normalizeTexts(body.texts)
  if (!texts) {
    return errorJson({ error: 'invalid_texts' }, 400, origin)
  }

  /** 子因标记：外泄仅枚举 cause，不带上游原文。 */
  type EmbedFailCause = 'ai_run_failed' | 'invalid_ai_response' | 'empty_embedding'
  class EmbedFailMarkedError extends Error {
    readonly causeCode: EmbedFailCause
    constructor(causeCode: EmbedFailCause) {
      super(causeCode)
      this.name = 'EmbedFailMarkedError'
      this.causeCode = causeCode
    }
  }

  try {
    // bge-m3：text 支持 string | string[]；一次 batch 降低往返
    let result: unknown
    try {
      result = (await env.AI.run(EMBEDDING_MODEL, {
        text: texts,
        truncate_inputs: true
      })) as unknown
    } catch (err) {
      logError(err, { path: '/api/ai/embed', userId, cause: 'ai_run_failed' })
      throw new EmbedFailMarkedError('ai_run_failed')
    }

    let embeddings: number[][]
    try {
      embeddings = extractEmbeddingsFromAiResponse(result, texts.length)
    } catch (err) {
      logError(err, { path: '/api/ai/embed', userId, cause: 'invalid_ai_response' })
      throw new EmbedFailMarkedError('invalid_ai_response')
    }

    const dim = embeddings[0]?.length ?? 0
    if (dim === 0) {
      throw new EmbedFailMarkedError('empty_embedding')
    }

    logInfo('embed_ok', {
      userId,
      count: texts.length,
      dim,
      durationMs: Date.now() - startedAt,
      quotaUsed: quota.used
    })

    return okJson(
      {
        success: true,
        data: {
          model: EMBEDDING_MODEL,
          dim,
          embeddings,
          quota: {
            used: quota.used,
            limit: quota.limit,
            remaining: Math.max(0, quota.limit - quota.used),
            // degraded：KV 故障 fail-open；used=0 表示未知未计数（additive，不破坏旧字段）
            ...(quota.degraded ? { degraded: true as const } : {})
          }
        }
      },
      origin
    )
  } catch (err) {
    if (err instanceof EmbedFailMarkedError) {
      return errorJson({ error: 'embed_failed', cause: err.causeCode }, 502, origin)
    }
    logError(err, { path: '/api/ai/embed', userId })
    return errorJson({ error: 'embed_failed' }, 502, origin)
  }
}
