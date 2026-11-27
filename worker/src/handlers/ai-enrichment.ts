/**
 * Capture enrichment：扩展侧调用的结构化提议代理（key 仅在 Worker）。
 * 返回 Zod 校验后的 proposal；扩展 merge 后再写 IndexedDB。
 * 鉴权后按 userId 计日配额，IP 日配额保留为第二道防线。
 */

import type { Env } from '../types/env'
import { isDeepSeekAiGatewayEnabled, resolveHostedModel } from '../config/ai-hosted'
import { resolveHostedModelForTask } from '../config/ai-task-kind'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import {
  EnrichmentCompleteRequestSchema,
  buildEnrichmentSystemPrompt,
  buildEnrichmentUserPrompt,
  parseEnrichmentProposalText
} from '../services/ai/memory-enrichment-proposal'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

const DEFAULT_DAILY_LIMIT = 80

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

function resolveDailyLimit(env: Env): number {
  const limit = Number.parseInt(env.AI_ENRICHMENT_DAILY_LIMIT ?? '', 10)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT
}

type QuotaPeekOk = { allowed: true; used: number; limit: number }
type QuotaPeekDenied = {
  allowed: false
  used: number
  limit: number
  reason: 'quota_exceeded' | 'kv_not_configured'
}

/** 只读探额（调用前；两道都过再扣）。 */
async function peekEnrichmentDailyQuota(
  env: Env,
  key: string
): Promise<QuotaPeekOk | QuotaPeekDenied> {
  const dailyLimit = resolveDailyLimit(env)
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { allowed: false, used: 0, limit: dailyLimit, reason: 'kv_not_configured' }
  }

  const raw = await kv.get(key)
  const used = raw ? Number.parseInt(raw, 10) || 0 : 0
  if (used >= dailyLimit) {
    return { allowed: false, used, limit: dailyLimit, reason: 'quota_exceeded' }
  }
  return { allowed: true, used, limit: dailyLimit }
}

/** 调用前扣 1 次（须已 peek 通过）。 */
async function commitEnrichmentDailyQuota(
  env: Env,
  key: string,
  peeked: { used: number; limit: number }
): Promise<{ used: number; limit: number }> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return peeked
  }
  const nextUsed = peeked.used + 1
  await kv.put(key, String(nextUsed), { expirationTtl: 60 * 60 * 48 })
  return { used: nextUsed, limit: peeked.limit }
}

/**
 * POST /api/ai/enrichment/complete
 * @param isAnonymous 设备 token 路径读自 user_meta；Supabase 过渡路径传 false（本 handler 不区分档）
 */
export async function handleEnrichmentComplete(
  request: Request,
  env: Env,
  userId: string,
  _isAnonymous = false
): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()
  const ip = clientIp(request)

  let providerId = 'unknown'
  try {
    providerId = resolveAiChatProvider(env).id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logInfo('enrichment_complete_rejected', {
      reason: 'ai_provider_unsupported',
      userId,
      ip,
      detail: message
    })
    return errorJson({ error: 'ai_provider_unsupported' }, 503, origin)
  }

  if (!isAiChatProviderConfigured(env)) {
    logInfo('enrichment_complete_rejected', {
      reason: 'ai_provider_not_configured',
      userId,
      ip,
      providerId
    })
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  if (env.AI_ENRICHMENT_PROXY_ENABLED?.trim() === 'false') {
    logInfo('enrichment_complete_rejected', {
      reason: 'enrichment_proxy_disabled',
      userId,
      ip
    })
    return errorJson({ error: 'enrichment_proxy_disabled' }, 403, origin)
  }

  const json = request.method === 'POST' ? await request.json().catch(() => null) : null
  const bodyParsed = EnrichmentCompleteRequestSchema.safeParse(json ?? {})
  if (!bodyParsed.success) {
    logInfo('enrichment_complete_rejected', { reason: 'invalid_body', userId, ip })
    return errorJson({ error: 'invalid_body' }, 400, origin)
  }

  const body = bodyParsed.data
  const hasSignal = Boolean(
    body.title?.trim() ||
    body.text?.trim() ||
    body.url?.trim() ||
    body.domain?.trim() ||
    body.note?.trim()
  )
  if (!hasSignal) {
    logInfo('enrichment_complete_rejected', { reason: 'missing_memory_fields', userId, ip })
    return errorJson({ error: 'missing_memory_fields' }, 400, origin)
  }

  const model = resolveHostedModelForTask(env, 'enrichment')
  const viaAiGateway = isDeepSeekAiGatewayEnabled(env)
  const day = utcDayKey()
  logInfo('enrichment_complete_start', {
    userId,
    ip,
    providerId,
    model,
    titleLength: body.title?.length ?? 0,
    textLength: body.text?.length ?? 0,
    hasRuleHints: Boolean(body.ruleHints),
    viaAiGateway
  })

  // 用户配额主道；IP 第二道；两道 peek 都过再调用前扣（失败不白烧另一道）
  const userKey = `enrich_ai:user:${userId}:${day}`
  const ipKey = `enrich_ai:${ip}:${day}`
  const userPeek = await peekEnrichmentDailyQuota(env, userKey)
  if (!userPeek.allowed) {
    if (userPeek.reason === 'kv_not_configured') {
      logInfo('enrichment_complete_rejected', { reason: 'kv_not_configured', userId, ip })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('enrichment_complete_quota_exceeded', {
      userId,
      ip,
      scope: 'user',
      used: userPeek.used,
      limit: userPeek.limit
    })
    return errorJson(
      {
        error: 'quota_exceeded',
        used: userPeek.used,
        limit: userPeek.limit
      },
      429,
      origin
    )
  }

  const ipPeek = await peekEnrichmentDailyQuota(env, ipKey)
  if (!ipPeek.allowed) {
    if (ipPeek.reason === 'kv_not_configured') {
      logInfo('enrichment_complete_rejected', { reason: 'kv_not_configured', userId, ip })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('enrichment_complete_quota_exceeded', {
      userId,
      ip,
      scope: 'ip',
      used: ipPeek.used,
      limit: ipPeek.limit
    })
    return errorJson(
      {
        error: 'quota_exceeded',
        used: userPeek.used,
        limit: userPeek.limit
      },
      429,
      origin
    )
  }

  const userQuota = await commitEnrichmentDailyQuota(env, userKey, userPeek)
  await commitEnrichmentDailyQuota(env, ipKey, ipPeek)

  try {
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      prompt: ' ',
      maxTokens: 400,
      temperature: 0,
      disableThinking: true,
      model,
      messages: [
        { role: 'system', content: buildEnrichmentSystemPrompt() },
        { role: 'user', content: buildEnrichmentUserPrompt(body) }
      ]
    })

    const proposal = parseEnrichmentProposalText(result.text, body)
    if (!proposal) {
      logInfo('enrichment_complete_parse_failed', {
        userId,
        ip,
        providerId,
        textLength: result.text.length,
        durationMs: Date.now() - startedAt
      })
      return errorJson({ error: 'enrichment_parse_failed' }, 502, origin)
    }

    logInfo('enrichment_complete_ok', {
      userId,
      ip,
      durationMs: Date.now() - startedAt,
      providerId: result.providerId,
      model: result.model || resolveHostedModel(env),
      tokensUsed: result.tokensUsed,
      keywordCount: proposal.keywords?.length ?? 0,
      entityCount: proposal.entities?.length ?? 0,
      hasSummary: Boolean(proposal.summary),
      quotaUsed: userQuota.used,
      quotaLimit: userQuota.limit,
      viaAiGateway
    })

    return okJson(
      {
        proposal,
        provider: 'enrichment',
        providerId: result.providerId,
        model: result.model || resolveHostedModel(env),
        tokensUsed: result.tokensUsed,
        quota: {
          used: userQuota.used,
          limit: userQuota.limit,
          remaining: Math.max(0, userQuota.limit - userQuota.used)
        }
      },
      origin
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError(err, {
      path: '/api/ai/enrichment/complete',
      userId,
      ip,
      durationMs: Date.now() - startedAt,
      providerId,
      detail: message
    })
    return errorJson({ error: 'enrichment_complete_failed' }, 500, origin)
  }
}
