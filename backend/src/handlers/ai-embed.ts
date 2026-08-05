/**
 * Pro 专用：Workers AI embedding（bge-m3）。
 * 鉴权：Supabase Bearer + isActiveProUser；按用户日配额防刷。
 */

import type { Env } from '../types/env'
import { isActiveProUser } from '../services/ai/require-pro-user'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

export const EMBEDDING_MODEL = '@cf/baai/bge-m3'
const MAX_BATCH = 8
/** 约 512 token 量级的字符截断（粗估）。 */
const MAX_CHARS_PER_TEXT = 2000
const DEFAULT_DAILY_LIMIT = 500

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

async function consumeEmbedDailyQuota(
  env: Env,
  userId: string
): Promise<
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; reason: 'quota_exceeded' | 'kv_not_configured' }
> {
  const limit = Number.parseInt(env.AI_EMBED_DAILY_LIMIT ?? '', 10)
  const dailyLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { allowed: false, used: 0, limit: dailyLimit, reason: 'kv_not_configured' }
  }

  const key = `embed_ai:${userId}:${utcDayKey()}`
  const raw = await kv.get(key)
  const used = raw ? Number.parseInt(raw, 10) || 0 : 0
  if (used >= dailyLimit) {
    return { allowed: false, used, limit: dailyLimit, reason: 'quota_exceeded' }
  }

  await kv.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 })
  return { allowed: true, used: used + 1, limit: dailyLimit }
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
    if (!Array.isArray(entry) || entry.length === 0) {
      throw new Error('invalid_ai_embedding_response')
    }
    return entry.map(Number)
  })
}

/**
 * POST /api/ai/embed
 */
export async function handleEmbed(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()

  if (!(await isActiveProUser(env, userId))) {
    logInfo('embed_rejected', { reason: 'pro_required', userId })
    return errorJson({ error: 'pro_required' }, 403, origin)
  }

  if (!env.AI) {
    logInfo('embed_rejected', { reason: 'ai_binding_missing', userId })
    return errorJson({ error: 'ai_binding_missing' }, 503, origin)
  }

  const quota = await consumeEmbedDailyQuota(env, userId)
  if (!quota.allowed) {
    logInfo('embed_rejected', {
      reason: quota.reason,
      userId,
      used: quota.used,
      limit: quota.limit
    })
    const status = quota.reason === 'kv_not_configured' ? 503 : 429
    return errorJson(
      { error: quota.reason, quota: { used: quota.used, limit: quota.limit } },
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

  try {
    // bge-m3：text 支持 string | string[]；一次 batch 降低往返
    const result = (await env.AI.run(EMBEDDING_MODEL, {
      text: texts,
      truncate_inputs: true
    })) as unknown
    const embeddings = extractEmbeddingsFromAiResponse(result, texts.length)
    const dim = embeddings[0]?.length ?? 0
    if (dim === 0) {
      throw new Error('empty_embedding')
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
            remaining: Math.max(0, quota.limit - quota.used)
          }
        }
      },
      origin
    )
  } catch (err) {
    logError(err, { path: '/api/ai/embed', userId })
    return errorJson({ error: 'embed_failed' }, 502, origin)
  }
}
