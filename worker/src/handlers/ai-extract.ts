/**
 * POST /api/ai/extract/complete — 打开库内页内容提炼（登录；独立配额；peek-then-commit）。
 */

import type { Env } from '../types/env'
import { resolveHostedModelForTask, resolveHostedMaxTokensForTask } from '../config/ai-task-kind'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import { resolveAiChatCompleter } from '../services/ai/ai-chat-router'
import {
  ExtractCompleteRequestSchema,
  buildExtractSummarySystemPrompt,
  buildExtractSummaryUserPrompt,
  parseExtractSummaryText
} from '../services/ai/extract-summary-proposal'
import { commitExtractQuota, peekExtractQuota } from '../services/ai/extract-quota'
import { isActiveProUser } from '../services/ai/require-pro-user'
import { buildAiGateRejectedLogFields } from '../services/ai/ai-gate-log'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

export async function handleExtractComplete(
  request: Request,
  env: Env,
  userId: string,
  isAnonymous = false
): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()
  const taskKind = 'extract' as const

  // 匿名禁止提炼（转正门禁；服务端强制，不进 peek）
  if (isAnonymous) {
    logInfo('extract_complete_rejected', { reason: 'anonymous_not_allowed', userId })
    return errorJson({ error: 'anonymous_not_allowed' }, 403, origin)
  }

  if (!isAiChatProviderConfigured(env)) {
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  let bodyUnknown: unknown = {}
  try {
    bodyUnknown = await request.json()
  } catch {
    bodyUnknown = {}
  }
  const bodyParsed = ExtractCompleteRequestSchema.safeParse(bodyUnknown)
  if (!bodyParsed.success) {
    logInfo('extract_complete_rejected', { reason: 'invalid_body', userId })
    return errorJson({ error: 'invalid_body' }, 400, origin)
  }
  const { url, title, text } = bodyParsed.data

  const isPro = await isActiveProUser(env, userId)
  const peek = await peekExtractQuota(env, userId, isPro)
  if (!peek.allowed) {
    logInfo('extract_complete_deferred', {
      userId,
      reason: peek.reason,
      tier: peek.snapshot.tier,
      used: peek.snapshot.used,
      limit: peek.snapshot.limit,
      dailyUsed: peek.snapshot.dailyUsed,
      dailyLimit: peek.snapshot.dailyLimit
    })
    if (peek.reason === 'kv_not_configured') {
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    return errorJson(
      {
        error: peek.reason,
        deferred: true,
        tier: peek.snapshot.tier,
        used: peek.snapshot.used,
        limit: peek.snapshot.limit,
        remaining: peek.snapshot.remaining,
        dailyUsed: peek.snapshot.dailyUsed,
        dailyLimit: peek.snapshot.dailyLimit,
        dailyRemaining: peek.snapshot.dailyRemaining
      },
      429,
      origin
    )
  }

  const model = resolveHostedModelForTask(env, taskKind)
  const maxTokens = resolveHostedMaxTokensForTask(taskKind, undefined)
  const completer = resolveAiChatCompleter(env)

  let rawText: string
  let completionUsage: {
    tokensUsed?: number
    promptTokens?: number
    completionTokens?: number
  } = {}
  try {
    const completion = await completer.complete(env, {
      model,
      maxTokens,
      temperature: 0,
      disableThinking: true,
      messages: [
        { role: 'system', content: buildExtractSummarySystemPrompt() },
        {
          role: 'user',
          content: buildExtractSummaryUserPrompt({
            url,
            text,
            ...(title !== undefined ? { title } : {})
          })
        }
      ],
      taskKind,
      priority: 'background'
    })
    rawText = completion.text
    completionUsage = {
      ...(completion.tokensUsed !== undefined ? { tokensUsed: completion.tokensUsed } : {}),
      ...(completion.promptTokens !== undefined ? { promptTokens: completion.promptTokens } : {}),
      ...(completion.completionTokens !== undefined
        ? { completionTokens: completion.completionTokens }
        : {})
    }
  } catch (error) {
    logError(error, { path: '/api/ai/extract/complete', userId, model })
    return errorJson({ error: 'provider_failed' }, 502, origin)
  }

  const parsed = parseExtractSummaryText(rawText, bodyParsed.data.text)
  if (parsed == null) {
    logInfo('extract_complete_parse_failed', {
      ...buildAiGateRejectedLogFields('extract', 'parse_failed'),
      userId,
      model,
      durationMs: Date.now() - startedAt,
      textLength: rawText.length
    })
    // 不扣费（peek-then-commit）
    return errorJson({ error: 'parse_failed' }, 422, origin)
  }

  const snapshot = await commitExtractQuota(env, peek.snapshot)
  logInfo('extract_complete_ok', {
    userId,
    model,
    durationMs: Date.now() - startedAt,
    summaryLength: parsed.summary.length,
    used: snapshot.used,
    limit: snapshot.limit,
    tokensUsed: completionUsage.tokensUsed ?? null,
    promptTokens: completionUsage.promptTokens ?? null,
    completionTokens: completionUsage.completionTokens ?? null
  })

  return okJson(
    {
      summary: parsed.summary,
      model,
      provider: resolveAiChatProvider(env).id,
      taskKind,
      tokensUsed: completionUsage.tokensUsed,
      promptTokens: completionUsage.promptTokens,
      completionTokens: completionUsage.completionTokens,
      quota: {
        used: snapshot.used,
        limit: snapshot.limit,
        remaining: snapshot.remaining,
        dailyUsed: snapshot.dailyUsed,
        dailyLimit: snapshot.dailyLimit,
        dailyRemaining: snapshot.dailyRemaining,
        tier: snapshot.tier
      }
    },
    origin
  )
}
