/**
 * 托管 LLM 接口处理器（登录可用；Free/Pro 配额分档）。
 *
 * hosted/complete 在扣配额前做形状 + system 指纹校验（见 hosted-system-prompts.ts）。
 * 残留：非服务端模板渲染；后缀注入风险受 device token + 自有配额约束。更彻底的服务端模板另立批。
 */

import type { Env } from '../types/env'
import type { AIHostedCompleteRequest } from '../types/ai'
import { okJson, errorJson } from '../utils/response'
import { resolveHostedModel } from '../config/ai-hosted'
import { resolveHostedMaxTokensForTask, resolveHostedModelForTask } from '../config/ai-task-kind'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import { peekAnonymousEmbedQuota } from './ai-embed'
import { consumeHostedQuota, getHostedQuotaSnapshot } from '../services/ai/usage-quota'
import { isActiveProUser } from '../services/ai/require-pro-user'
import {
  parseHostedCompleteTaskKind,
  validateHostedSystemPrompt,
  type HostedCompleteTaskKind
} from '../services/ai/hosted-system-prompts'
import { info as logInfo, logError } from '../utils/logger'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * 获取托管 LLM 配额信息（须登录；不要求 Pro）。
 * @param isAnonymous 设备 token 路径读自 user_meta；Supabase 过渡路径传 false
 */
export async function handleHostedQuota(
  request: Request,
  env: Env,
  userId: string,
  isAnonymous = false
): Promise<Response> {
  const origin = request.headers.get('origin')

  if (!env.AI_USAGE_KV) {
    return errorJson({ error: 'kv_not_configured' }, 503, origin)
  }

  // 匿名必须在 isPro 之前短路，避免落入 Free 月配额
  const isPro = isAnonymous ? false : await isActiveProUser(env, userId)
  const snapshot = await getHostedQuotaSnapshot(env, userId, { isAnonymous, isPro })

  // 匿名试用：附加 embedding 终身剩余（Settings 展示）；正式档不附
  const embed =
    isAnonymous && snapshot.tier === 'anonymous' ? await peekAnonymousEmbedQuota(env, userId) : null

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
      monthKey: snapshot.monthKey,
      ...(embed
        ? {
            embedUsed: embed.used,
            embedLimit: embed.limit,
            embedRemaining: embed.remaining
          }
        : {})
    },
    origin
  )
}

/** 过滤后 messages 摘要（绝不记内容）。 */
function summarizeMessageShape(messages: ChatMessage[] | undefined): {
  messageCount: number
  roles: string
} {
  if (!messages || messages.length === 0) {
    return { messageCount: 0, roles: '' }
  }
  return {
    messageCount: messages.length,
    roles: messages.map(m => m.role).join(',')
  }
}

/**
 * 在扣配额前校验 taskKind / messages 形状 / system 指纹。
 * 失败返回 Response；成功返回规范化后的 messages 与 taskKind。
 */
function validateHostedCompleteBody(
  body: AIHostedCompleteRequest,
  userId: string,
  origin: string | null
):
  | { ok: true; taskKind: HostedCompleteTaskKind; messages: ChatMessage[] }
  | { ok: false; response: Response } {
  const taskKind = parseHostedCompleteTaskKind(body.taskKind)
  if (taskKind === null) {
    logInfo('hosted_complete_rejected', {
      reason: 'invalid_task_kind',
      userId,
      taskKind: typeof body.taskKind === 'string' ? body.taskKind : typeof body.taskKind,
      ...summarizeMessageShape(body.messages)
    })
    return {
      ok: false,
      response: errorJson({ error: 'invalid_task_kind' }, 400, origin)
    }
  }

  // bare prompt（无 messages）一律 400；拒掉的请求不扣配额
  if (!body.messages || !Array.isArray(body.messages)) {
    logInfo('hosted_complete_rejected', {
      reason: 'missing_messages',
      userId,
      taskKind,
      hasPrompt: Boolean(body.prompt?.trim())
    })
    return {
      ok: false,
      response: errorJson({ error: 'missing_messages' }, 400, origin)
    }
  }

  const messages = body.messages.filter(
    m =>
      m.content.trim().length > 0 &&
      (m.role === 'system' || m.role === 'user' || m.role === 'assistant')
  )

  if (messages.length !== 2 || messages[0]?.role !== 'system' || messages[1]?.role !== 'user') {
    logInfo('hosted_complete_rejected', {
      reason: 'invalid_messages',
      userId,
      taskKind,
      ...summarizeMessageShape(messages)
    })
    return {
      ok: false,
      response: errorJson({ error: 'invalid_messages' }, 400, origin)
    }
  }

  const systemContent = messages[0]!.content
  if (!validateHostedSystemPrompt(taskKind, systemContent)) {
    logInfo('hosted_complete_rejected', {
      reason: 'invalid_system_prompt',
      userId,
      taskKind,
      systemLength: systemContent.length,
      ...summarizeMessageShape(messages)
    })
    return {
      ok: false,
      response: errorJson({ error: 'invalid_system_prompt' }, 400, origin)
    }
  }

  return { ok: true, taskKind, messages }
}

/**
 * 处理托管 LLM 文本补全（须登录；Free/Pro/匿名配额分档）。
 * @param isAnonymous 设备 token 路径读自 user_meta；Supabase 过渡路径传 false
 */
export async function handleHostedComplete(
  request: Request,
  env: Env,
  userId: string,
  isAnonymous = false
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

  const validated = validateHostedCompleteBody(body, userId, origin)
  if (!validated.ok) {
    return validated.response
  }
  const { taskKind, messages } = validated

  const model = resolveHostedModelForTask(env, taskKind)
  const maxTokens = resolveHostedMaxTokensForTask(taskKind, body.maxTokens)

  const isPro = isAnonymous ? false : await isActiveProUser(env, userId)
  const quotaResult = await consumeHostedQuota(env, userId, { isAnonymous, isPro })
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
    hasMessages: true,
    messageCount: messages.length,
    maxTokens,
    requestedMaxTokens: body.maxTokens ?? null
  })

  try {
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      messages,
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
      promptTokens: result.promptTokens ?? null,
      completionTokens: result.completionTokens ?? null,
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
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
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
