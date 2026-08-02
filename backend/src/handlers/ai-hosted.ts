/**
 * Pro 托管 LLM 接口处理器
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
 * 获取 Pro 托管 LLM 配额信息
 */
export async function handleHostedQuota(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const origin = request.headers.get('origin')

  const isPro = await isActiveProUser(env, userId)
  if (!isPro) {
    return errorJson({ error: 'pro_required' }, 403, origin)
  }

  if (!env.AI_USAGE_KV) {
    return errorJson({ error: 'kv_not_configured' }, 503, origin)
  }

  const snapshot = await getHostedQuotaSnapshot(env, userId)

  return okJson(
    {
      model: resolveHostedModel(env),
      used: snapshot.used,
      limit: snapshot.limit,
      remaining: snapshot.remaining,
      monthKey: snapshot.monthKey
    },
    origin
  )
}

/**
 * 处理 Pro 托管 LLM 文本补全
 */
export async function handleHostedComplete(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const origin = request.headers.get('origin')

  const isPro = await isActiveProUser(env, userId)
  if (!isPro) {
    return errorJson({ error: 'pro_required' }, 403, origin)
  }

  if (!isAiChatProviderConfigured(env)) {
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  const quotaResult = await consumeHostedQuota(env, userId)
  if (!quotaResult.allowed) {
    if (quotaResult.reason === 'kv_not_configured') {
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    return errorJson(
      {
        error: 'quota_exceeded',
        used: quotaResult.snapshot.used,
        limit: quotaResult.snapshot.limit,
        remaining: quotaResult.snapshot.remaining
      },
      429,
      origin
    )
  }

  let body: AIHostedCompleteRequest = {}
  if (request.method === 'POST') {
    body = (await request.json().catch(() => ({}))) as AIHostedCompleteRequest
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return errorJson({ error: 'missing_prompt' }, 400, origin)
  }

  try {
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      prompt,
      ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {})
    })

    return okJson(
      {
        text: result.text,
        provider: 'hosted',
        providerId: result.providerId,
        model: result.model,
        tokensUsed: result.tokensUsed,
        quota: {
          used: quotaResult.snapshot.used,
          limit: quotaResult.snapshot.limit,
          remaining: quotaResult.snapshot.remaining
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
