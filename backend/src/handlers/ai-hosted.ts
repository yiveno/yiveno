/**
 * 托管 LLM 接口处理器（登录可用；Free/Pro 配额分档）。
 */

import type { Env } from '../types/env'
import type { AIHostedCompleteRequest } from '../types/ai'
import { okJson, errorJson } from '../utils/response'
import { resolveHostedModel } from '../config/ai-hosted'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import { consumeHostedQuota, getHostedQuotaSnapshot } from '../services/ai/usage-quota'
import { isActiveProUser } from '../services/ai/require-pro-user'
import { logError } from '../utils/logger'

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

  if (!isAiChatProviderConfigured(env)) {
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  const isPro = await isActiveProUser(env, userId)
  const quotaResult = await consumeHostedQuota(env, userId, isPro)
  if (!quotaResult.allowed) {
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

  let body: AIHostedCompleteRequest = {}
  if (request.method === 'POST') {
    body = (await request.json().catch(() => ({}))) as AIHostedCompleteRequest
  }

  const messages = body.messages?.filter(
    m =>
      m.content.trim().length > 0 &&
      (m.role === 'system' || m.role === 'user' || m.role === 'assistant')
  )
  const prompt = body.prompt?.trim()
  if ((!messages || messages.length === 0) && !prompt) {
    return errorJson({ error: 'missing_prompt' }, 400, origin)
  }

  try {
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      ...(messages && messages.length > 0 ? { messages } : {}),
      ...(prompt ? { prompt } : {}),
      ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
      disableThinking: true
    })

    return okJson(
      {
        text: result.text,
        provider: 'hosted',
        providerId: result.providerId,
        model: result.model,
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
    logError(err, { path: '/api/ai/hosted/complete', userId, detail: message })
    return errorJson({ error: 'hosted_complete_failed' }, 500, origin)
  }
}
