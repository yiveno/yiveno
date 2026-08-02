/**
 * Recall 线索理解：扩展侧调用的 DeepSeek 代理（key 仅在 Worker Secret）。
 * M1 暂不强制 Pro；按 IP 日配额防刷。正式商业化可改为 hosted + Pro。
 */

import type { Env } from '../types/env'
import { isDeepSeekAiGatewayEnabled, resolveHostedModel } from '../config/ai-hosted'
import { completeWithDeepSeek } from '../services/ai/deepseek-client'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

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
): Promise<
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; reason: 'quota_exceeded' | 'kv_not_configured' }
> {
  const limit = Number.parseInt(env.AI_CLUE_DAILY_LIMIT ?? '', 10)
  const dailyLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { allowed: false, used: 0, limit: dailyLimit, reason: 'kv_not_configured' }
  }

  const key = `clue_ai:${ip}:${utcDayKey()}`
  const raw = await kv.get(key)
  const used = raw ? Number.parseInt(raw, 10) || 0 : 0
  if (used >= dailyLimit) {
    return { allowed: false, used, limit: dailyLimit, reason: 'quota_exceeded' }
  }

  await kv.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 })
  return { allowed: true, used: used + 1, limit: dailyLimit }
}

/**
 * POST /api/ai/clue/complete
 */
export async function handleClueComplete(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()
  const ip = clientIp(request)

  if (!env.DEEPSEEK_API_KEY?.trim()) {
    logInfo('clue_complete_rejected', { reason: 'deepseek_not_configured', ip })
    return errorJson({ error: 'deepseek_not_configured' }, 503, origin)
  }

  // 显式关闭：AI_CLUE_PROXY_ENABLED=false
  if (env.AI_CLUE_PROXY_ENABLED?.trim() === 'false') {
    logInfo('clue_complete_rejected', { reason: 'clue_proxy_disabled', ip })
    return errorJson({ error: 'clue_proxy_disabled' }, 403, origin)
  }

  let body: ClueCompleteRequestBody = {}
  if (request.method === 'POST') {
    body = (await request.json().catch(() => ({}))) as ClueCompleteRequestBody
  }

  const hasMessages = Array.isArray(body.messages) && body.messages.length > 0
  const prompt = body.prompt?.trim() ?? ''
  if (!hasMessages && !prompt) {
    logInfo('clue_complete_rejected', { reason: 'missing_prompt_or_messages', ip })
    return errorJson({ error: 'missing_prompt_or_messages' }, 400, origin)
  }

  const viaAiGateway = isDeepSeekAiGatewayEnabled(env)
  logInfo('clue_complete_start', {
    ip,
    hasMessages,
    messageCount: hasMessages ? body.messages!.length : 0,
    promptLength: prompt.length,
    maxTokens: body.maxTokens ?? 400,
    viaAiGateway
  })

  const quota = await consumeClueDailyQuota(env, ip)
  if (!quota.allowed) {
    if (quota.reason === 'kv_not_configured') {
      logInfo('clue_complete_rejected', { reason: 'kv_not_configured', ip })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('clue_complete_quota_exceeded', {
      ip,
      used: quota.used,
      limit: quota.limit
    })
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

    logInfo('clue_complete_ok', {
      ip,
      durationMs: Date.now() - startedAt,
      model: result.model || resolveHostedModel(env),
      tokensUsed: result.tokensUsed,
      textLength: result.text.length,
      quotaUsed: quota.used,
      quotaLimit: quota.limit,
      viaAiGateway
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
    logError(err, {
      path: '/api/ai/clue/complete',
      ip,
      durationMs: Date.now() - startedAt,
      detail: message
    })
    // 对外稳定错误码，不回传上游原文
    return errorJson({ error: 'clue_complete_failed' }, 500, origin)
  }
}
