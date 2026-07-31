/**
 * Recall 线索理解：扩展侧调用的 DeepSeek 代理（key 仅在 Worker Secret）。
 * M1 暂不强制 Pro；按 IP 日配额防刷。正式商业化可改为 hosted + Pro。
 */

import type { Env } from '../types/env'
import { resolveHostedModel } from '../config/ai-hosted'
import { completeWithDeepSeek } from '../services/ai/deepseek-client'
import { okJson, errorJson } from '../utils/response'

const DEFAULT_DAILY_LIMIT = 200

export interface ClueCompleteRequestBody {
  prompt?: string
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function utcDayKey(date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function consumeClueDailyQuota(
  env: Env,
  ip: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = Number.parseInt(env.AI_CLUE_DAILY_LIMIT ?? '', 10)
  const dailyLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { allowed: true, used: 0, limit: dailyLimit }
  }

  const key = `clue_ai:${ip}:${utcDayKey()}`
  const raw = await kv.get(key)
  const used = raw ? Number.parseInt(raw, 10) || 0 : 0
  if (used >= dailyLimit) {
    return { allowed: false, used, limit: dailyLimit }
  }

  await kv.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 })
  return { allowed: true, used: used + 1, limit: dailyLimit }
}

/**
 * POST /api/ai/clue/complete
 */
export async function handleClueComplete(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin')

  if (!env.DEEPSEEK_API_KEY?.trim()) {
    return errorJson({ error: 'deepseek_not_configured' }, 503, origin)
  }

  // 显式关闭：AI_CLUE_PROXY_ENABLED=false
  if (env.AI_CLUE_PROXY_ENABLED?.trim() === 'false') {
    return errorJson({ error: 'clue_proxy_disabled' }, 403, origin)
  }

  let body: ClueCompleteRequestBody = {}
  if (request.method === 'POST') {
    body = (await request.json().catch(() => ({}))) as ClueCompleteRequestBody
  }

  const hasMessages = Array.isArray(body.messages) && body.messages.length > 0
  const prompt = body.prompt?.trim() ?? ''
  if (!hasMessages && !prompt) {
    return errorJson({ error: 'missing_prompt_or_messages' }, 400, origin)
  }

  const quota = await consumeClueDailyQuota(env, clientIp(request))
  if (!quota.allowed) {
    return errorJson(
      {
        error: 'quota_exceeded',
        used: quota.used,
        limit: quota.limit
      },
      429,
      origin
    )
  }

  try {
    const result = await completeWithDeepSeek(env, prompt || ' ', {
      maxTokens: body.maxTokens ?? 400,
      temperature: body.temperature ?? 0,
      disableThinking: true,
      ...(hasMessages ? { messages: body.messages } : {})
    })

    return okJson(
      {
        text: result.text,
        provider: 'clue',
        model: result.model || resolveHostedModel(env),
        tokensUsed: result.tokensUsed,
        quota: {
          used: quota.used,
          limit: quota.limit,
          remaining: Math.max(0, quota.limit - quota.used)
        }
      },
      origin
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return errorJson({ error: message }, 500, origin)
  }
}
