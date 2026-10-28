/**
 * Recall 线索理解：扩展侧调用的聊天补全代理（key 仅在 Worker Secret）。
 * 上游厂商由 AiChatProvider + AI_PROVIDER 选择；M1 暂不强制 Pro；按 IP 日配额防刷。
 */

import type { Env } from '../types/env'
import { isDeepSeekAiGatewayEnabled, resolveHostedModel } from '../config/ai-hosted'
import {
  parseAiChatTaskKind,
  resolveHostedMaxTokensForTask,
  resolveHostedModelForTask,
  type AiChatTaskKind
} from '../config/ai-task-kind'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

const DEFAULT_DAILY_LIMIT = 200

export interface ClueCompleteRequestBody {
  prompt?: string
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
  /** 任务种类（闭集；缺省 nlu） */
  taskKind?: string
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

  let providerId = 'unknown'
  try {
    providerId = resolveAiChatProvider(env).id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logInfo('clue_complete_rejected', { reason: 'ai_provider_unsupported', ip, detail: message })
    return errorJson({ error: 'ai_provider_unsupported' }, 503, origin)
  }

  if (!isAiChatProviderConfigured(env)) {
    logInfo('clue_complete_rejected', {
      reason: 'ai_provider_not_configured',
      ip,
      providerId
    })
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
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

  const taskKind: AiChatTaskKind = parseAiChatTaskKind(body.taskKind)
  const model = resolveHostedModelForTask(env, taskKind)
  const maxTokens = resolveHostedMaxTokensForTask(taskKind, body.maxTokens)

  const hasMessages = Array.isArray(body.messages) && body.messages.length > 0
  const prompt = body.prompt?.trim() ?? ''
  if (!hasMessages && !prompt) {
    logInfo('clue_complete_rejected', {
      reason: 'missing_prompt_or_messages',
      ip,
      taskKind,
      model
    })
    return errorJson({ error: 'missing_prompt_or_messages' }, 400, origin)
  }

  const viaAiGateway = isDeepSeekAiGatewayEnabled(env)
  logInfo('clue_complete_start', {
    ip,
    providerId,
    taskKind,
    model,
    hasMessages,
    messageCount: hasMessages ? body.messages!.length : 0,
    promptLength: prompt.length,
    maxTokens,
    requestedMaxTokens: body.maxTokens ?? null,
    viaAiGateway
  })

  const quota = await consumeClueDailyQuota(env, ip)
  if (!quota.allowed) {
    if (quota.reason === 'kv_not_configured') {
      logInfo('clue_complete_rejected', { reason: 'kv_not_configured', ip, taskKind, model })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('clue_complete_quota_exceeded', {
      ip,
      taskKind,
      model,
      used: quota.used,
      limit: quota.limit,
      outcome: 'quota'
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
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      prompt: prompt || ' ',
      maxTokens,
      temperature: body.temperature ?? 0,
      disableThinking: true,
      model,
      ...(hasMessages ? { messages: body.messages } : {})
    })

    logInfo('clue_complete_ok', {
      ip,
      taskKind,
      latencyMs: Date.now() - startedAt,
      providerId: result.providerId,
      model: result.model || resolveHostedModel(env),
      tokensUsed: result.tokensUsed,
      textLength: result.text.length,
      quotaUsed: quota.used,
      quotaLimit: quota.limit,
      viaAiGateway,
      outcome: 'ok'
    })

    return okJson(
      {
        text: result.text,
        provider: 'clue',
        providerId: result.providerId,
        model: result.model || resolveHostedModel(env),
        taskKind,
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
      taskKind,
      model,
      latencyMs: Date.now() - startedAt,
      providerId,
      outcome: 'provider_error',
      detail: message
    })
    return errorJson({ error: 'clue_complete_failed' }, 500, origin)
  }
}
