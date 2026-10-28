/**
 * 托管 LLM 接口处理器（登录可用；Free/Pro 配额分档）。
 */

import type { Env } from '../types/env'
import type { AIHostedCompleteRequest } from '../types/ai'
import { okJson, errorJson } from '../utils/response'
import { resolveHostedModel } from '../config/ai-hosted'
import {
  parseAiChatTaskKind,
  resolveHostedMaxTokensForTask,
  resolveHostedModelForTask
} from '../config/ai-task-kind'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import { consumeHostedQuota, getHostedQuotaSnapshot } from '../services/ai/usage-quota'
import { isActiveProUser } from '../services/ai/require-pro-user'
import { info as logInfo, logError } from '../utils/logger'

/**
 * 获取托管 LLM 配额信息（须登录；不要求 Pro）。
 */
export async function handleHostedQuota(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const origin = request.headers.get('origin')

  if (!env.AI_USAGE_KV) {
    return errorJson({ error: 'kv_not_configured' }, 503, origin)
  }

  const isPro = await isActiveProUser(env, userId)
  const snapshot = await getHostedQuotaSnapshot(env, userId, isPro)

  return okJson(
    {
      model: resolveHostedModel(env),
      tier: snapshot.tier,
      used: snapshot.used,
      limit: snapshot.limit,
      remaining: snapshot.remaining,
      dailyUsed: snapshot.dailyUsed,
      dailyLimit: snapshot.dailyLimit,
      dailyRemaining: snapshot.dailyRemaining,
      monthKey: snapshot.monthKey
    },
    origin
  )
}

/**
 * 处理托管 LLM 文本补全（须登录；Free/Pro 配额分档）。
 */
export async function handleHostedComplete(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()

  if (!isAiChatProviderConfigured(env)) {
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  let body: AIHostedCompleteRequest = {}
  if (request.method === 'POST') {
    body = (await request.json().catch(() => ({}))) as AIHostedCompleteRequest
  }

  const taskKind = parseAiChatTaskKind(body.taskKind)
  const model = resolveHostedModelForTask(env, taskKind)
  const maxTokens = resolveHostedMaxTokensForTask(taskKind, body.maxTokens)

  const messages = body.messages?.filter(
    m =>
      m.content.trim().length > 0 &&
      (m.role === 'system' || m.role === 'user' || m.role === 'assistant')
  )
  const prompt = body.prompt?.trim()
  if ((!messages || messages.length === 0) && !prompt) {
    logInfo('hosted_complete_rejected', {
      reason: 'missing_prompt',
      userId,
      taskKind,
      model
    })
    return errorJson({ error: 'missing_prompt' }, 400, origin)
  }

  const isPro = await isActiveProUser(env, userId)
  const quotaResult = await consumeHostedQuota(env, userId, isPro)
  if (!quotaResult.allowed) {
    logInfo('hosted_complete_quota_exceeded', {
      userId,
      taskKind,
      model,
      reason: quotaResult.reason ?? 'quota_exceeded',
      tier: quotaResult.snapshot.tier,
      used: quotaResult.snapshot.used,
      limit: quotaResult.snapshot.limit
    })
    if (quotaResult.reason === 'kv_not_configured') {
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    return errorJson(
      {
        error: quotaResult.reason ?? 'quota_exceeded',
        tier: quotaResult.snapshot.tier,
        used: quotaResult.snapshot.used,
        limit: quotaResult.snapshot.limit,
        remaining: quotaResult.snapshot.remaining,
        dailyUsed: quotaResult.snapshot.dailyUsed,
        dailyLimit: quotaResult.snapshot.dailyLimit,
        dailyRemaining: quotaResult.snapshot.dailyRemaining
      },
      429,
      origin
    )
  }

  logInfo('hosted_complete_start', {
    userId,
    taskKind,
    model,
    hasMessages: Boolean(messages && messages.length > 0),
    messageCount: messages?.length ?? 0,
    maxTokens,
    requestedMaxTokens: body.maxTokens ?? null
  })

  try {
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      ...(messages && messages.length > 0 ? { messages } : {}),
      ...(prompt ? { prompt } : {}),
      maxTokens,
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
      model,
      disableThinking: true
    })

    logInfo('hosted_complete_ok', {
      userId,
      taskKind,
      model: result.model,
      providerId: result.providerId,
      latencyMs: Date.now() - startedAt,
      tokensUsed: result.tokensUsed ?? null,
      textLength: result.text.length,
      outcome: 'ok'
    })

    return okJson(
      {
        text: result.text,
        provider: 'hosted',
        providerId: result.providerId,
        model: result.model,
        taskKind,
        tokensUsed: result.tokensUsed,
        quota: {
          tier: quotaResult.snapshot.tier,
          used: quotaResult.snapshot.used,
          limit: quotaResult.snapshot.limit,
          remaining: quotaResult.snapshot.remaining,
          dailyUsed: quotaResult.snapshot.dailyUsed,
          dailyLimit: quotaResult.snapshot.dailyLimit,
          dailyRemaining: quotaResult.snapshot.dailyRemaining
        }
      },
      origin
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError(err, {
      path: '/api/ai/hosted/complete',
      userId,
      taskKind,
      model,
      latencyMs: Date.now() - startedAt,
      outcome: 'provider_error',
      detail: message
    })
    return errorJson({ error: 'hosted_complete_failed' }, 500, origin)
  }
}
