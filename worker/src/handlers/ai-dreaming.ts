/**
 * POST /api/ai/dreaming/complete — 夜间命题批量编译（登录；独立配额；peek-then-commit）。
 */

import type { Env } from '../types/env'
import { resolveHostedModelForTask, resolveHostedMaxTokensForTask } from '../config/ai-task-kind'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import {
  DreamingCompileRequestSchema,
  buildDreamingCompileSystemPrompt,
  buildDreamingCompileUserPrompt,
  parseDreamingCompileText
} from '../services/ai/dreaming-compile-proposal'
import { commitDreamingQuota, peekDreamingQuota } from '../services/ai/dreaming-quota'
import { isActiveProUser } from '../services/ai/require-pro-user'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

export async function handleDreamingComplete(
  request: Request,
  env: Env,
  userId: string,
  isAnonymous = false
): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()
  const taskKind = 'dreaming' as const

  // 匿名禁止 Dreaming（转正门禁；服务端强制，不进 peek）
  if (isAnonymous) {
    logInfo('dreaming_complete_rejected', { reason: 'anonymous_not_allowed', userId })
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
  const bodyParsed = DreamingCompileRequestSchema.safeParse(bodyUnknown)
  if (!bodyParsed.success) {
    logInfo('dreaming_complete_rejected', { reason: 'invalid_body', userId })
    return errorJson({ error: 'invalid_body' }, 400, origin)
  }
  const sources = bodyParsed.data.sources
  const allowedIds = new Set(sources.map(source => source.id))

  const isPro = await isActiveProUser(env, userId)
  const peek = await peekDreamingQuota(env, userId, isPro)
  if (!peek.allowed) {
    logInfo('dreaming_complete_deferred', {
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
  const provider = resolveAiChatProvider(env)

  let rawText: string
  let completionUsage: {
    tokensUsed?: number
    promptTokens?: number
    completionTokens?: number
  } = {}
  try {
    const completion = await provider.complete(env, {
      model,
      maxTokens,
      temperature: 0,
      disableThinking: true,
      messages: [
        { role: 'system', content: buildDreamingCompileSystemPrompt() },
        { role: 'user', content: buildDreamingCompileUserPrompt(sources) }
      ]
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
    logError(error, { path: '/api/ai/dreaming/complete', userId, model })
    return errorJson({ error: 'provider_failed' }, 502, origin)
  }

  const parsed = parseDreamingCompileText(rawText)
  if (parsed == null) {
    logInfo('dreaming_complete_parse_failed', {
      userId,
      model,
      durationMs: Date.now() - startedAt,
      textLength: rawText.length
    })
    // 不扣费（peek-then-commit）
    return errorJson({ error: 'parse_failed' }, 422, origin)
  }

  const results = parsed.results
    .filter(row => allowedIds.has(row.sourceId))
    .map(row => ({
      sourceId: row.sourceId,
      propositions: row.propositions.filter(prop => prop.sourceQuote.trim().length > 0)
    }))

  const snapshot = await commitDreamingQuota(env, peek.snapshot)
  logInfo('dreaming_complete_ok', {
    userId,
    model,
    sourceCount: sources.length,
    resultCount: results.length,
    durationMs: Date.now() - startedAt,
    used: snapshot.used,
    limit: snapshot.limit,
    tokensUsed: completionUsage.tokensUsed ?? null,
    promptTokens: completionUsage.promptTokens ?? null,
    completionTokens: completionUsage.completionTokens ?? null
  })

  return okJson(
    {
      results,
      model,
      provider: provider.id,
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
