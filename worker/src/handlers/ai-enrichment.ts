/**
 * Capture enrichment：扩展侧调用的结构化提议代理（key 仅在 Worker）。
 * 返回 Zod 校验后的 proposal；扩展 merge 后再写 IndexedDB。
 */

import type { Env } from '../types/env'
import { isDeepSeekAiGatewayEnabled, resolveHostedModel } from '../config/ai-hosted'
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

async function consumeEnrichmentDailyQuota(
  env: Env,
  ip: string
): Promise<
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; reason: 'quota_exceeded' | 'kv_not_configured' }
> {
  const limit = Number.parseInt(env.AI_ENRICHMENT_DAILY_LIMIT ?? '', 10)
  const dailyLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { allowed: false, used: 0, limit: dailyLimit, reason: 'kv_not_configured' }
  }

  const key = `enrich_ai:${ip}:${utcDayKey()}`
  const raw = await kv.get(key)
  const used = raw ? Number.parseInt(raw, 10) || 0 : 0
  if (used >= dailyLimit) {
    return { allowed: false, used, limit: dailyLimit, reason: 'quota_exceeded' }
  }

  await kv.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 })
  return { allowed: true, used: used + 1, limit: dailyLimit }
}

/**
 * POST /api/ai/enrichment/complete
 */
export async function handleEnrichmentComplete(request: Request, env: Env): Promise<Response> {
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
      ip,
      detail: message
    })
    return errorJson({ error: 'ai_provider_unsupported' }, 503, origin)
  }

  if (!isAiChatProviderConfigured(env)) {
    logInfo('enrichment_complete_rejected', {
      reason: 'ai_provider_not_configured',
      ip,
      providerId
    })
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  if (env.AI_ENRICHMENT_PROXY_ENABLED?.trim() === 'false') {
    logInfo('enrichment_complete_rejected', { reason: 'enrichment_proxy_disabled', ip })
    return errorJson({ error: 'enrichment_proxy_disabled' }, 403, origin)
  }

  const json = request.method === 'POST' ? await request.json().catch(() => null) : null
  const bodyParsed = EnrichmentCompleteRequestSchema.safeParse(json ?? {})
  if (!bodyParsed.success) {
    logInfo('enrichment_complete_rejected', { reason: 'invalid_body', ip })
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
    logInfo('enrichment_complete_rejected', { reason: 'missing_memory_fields', ip })
    return errorJson({ error: 'missing_memory_fields' }, 400, origin)
  }

  const viaAiGateway = isDeepSeekAiGatewayEnabled(env)
  logInfo('enrichment_complete_start', {
    ip,
    providerId,
    titleLength: body.title?.length ?? 0,
    textLength: body.text?.length ?? 0,
    hasRuleHints: Boolean(body.ruleHints),
    viaAiGateway
  })

  const quota = await consumeEnrichmentDailyQuota(env, ip)
  if (!quota.allowed) {
    if (quota.reason === 'kv_not_configured') {
      logInfo('enrichment_complete_rejected', { reason: 'kv_not_configured', ip })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('enrichment_complete_quota_exceeded', {
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
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      prompt: ' ',
      maxTokens: 400,
      temperature: 0,
      disableThinking: true,
      messages: [
        { role: 'system', content: buildEnrichmentSystemPrompt() },
        { role: 'user', content: buildEnrichmentUserPrompt(body) }
      ]
    })

    const proposal = parseEnrichmentProposalText(result.text)
    if (!proposal) {
      logInfo('enrichment_complete_parse_failed', {
        ip,
        providerId,
        textPreview: result.text.slice(0, 160),
        durationMs: Date.now() - startedAt
      })
      return errorJson({ error: 'enrichment_parse_failed' }, 502, origin)
    }

    logInfo('enrichment_complete_ok', {
      ip,
      durationMs: Date.now() - startedAt,
      providerId: result.providerId,
      model: result.model || resolveHostedModel(env),
      tokensUsed: result.tokensUsed,
      keywordCount: proposal.keywords?.length ?? 0,
      entityCount: proposal.entities?.length ?? 0,
      hasSummary: Boolean(proposal.summary),
      quotaUsed: quota.used,
      quotaLimit: quota.limit,
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
      path: '/api/ai/enrichment/complete',
      ip,
      durationMs: Date.now() - startedAt,
      providerId,
      detail: message
    })
    return errorJson({ error: 'enrichment_complete_failed' }, 500, origin)
  }
}
