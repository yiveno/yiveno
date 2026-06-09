/**
 * Pro 托管 LLM 接口处理器
 */

import type { Env } from '../types/env'
import type { AIHostedCompleteRequest } from '../types/ai'
import { okJson, errorJson } from '../utils/response'
import { resolveHostedModel } from '../config/ai-hosted'
import { completeWithDeepSeek } from '../services/ai/deepseek-client'
import { consumeHostedQuota, getHostedQuotaSnapshot } from '../services/ai/usage-quota'
import { isActiveProUser } from '../services/ai/require-pro-user'

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

  const quotaResult = await consumeHostedQuota(env, userId)
  if (!quotaResult.allowed) {
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
    const deepSeekOptions = {
      ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {})
    }

    const result = await completeWithDeepSeek(env, prompt, deepSeekOptions)

    return okJson(
      {
        text: result.text,
        provider: 'hosted',
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
    return errorJson({ error: message }, 500, origin)
  }
}
