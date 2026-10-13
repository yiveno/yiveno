/**
 * Getting Started 示意 clue：扩展侧调用的结构化生成代理（key 仅在 Worker）。
 * IP 日配额；未登录可用；与 enrichment 同档心智。
 * 配额仅在成功 parse 后扣减，避免模型垃圾 JSON 白烧额度。
 */

import type { Env } from '../types/env'
import { isDeepSeekAiGatewayEnabled, resolveHostedModel } from '../config/ai-hosted'
import { isAiChatProviderConfigured, resolveAiChatProvider } from '../services/ai/ai-chat-provider'
import {
  GsClueSamplesCompleteRequestSchema,
  buildGsClueSamplesSystemPrompt,
  buildGsClueSamplesUserPrompt,
  parseGsClueSamplesText
} from '../services/ai/gs-clue-samples-proposal'
import { okJson, errorJson } from '../utils/response'
import { info as logInfo, logError } from '../utils/logger'

const DEFAULT_DAILY_LIMIT = 40

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
  const limit = Number.parseInt(env.AI_GS_CLUE_SAMPLES_DAILY_LIMIT ?? '', 10)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT
}

/** 只读探额：超限则拒绝；不写 KV。 */
async function peekGsClueSamplesDailyQuota(
  env: Env,
  ip: string
): Promise<
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; reason: 'quota_exceeded' | 'kv_not_configured' }
> {
  const dailyLimit = resolveDailyLimit(env)
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { allowed: false, used: 0, limit: dailyLimit, reason: 'kv_not_configured' }
  }

  const key = `gs_clue_samples_ai:${ip}:${utcDayKey()}`
  const raw = await kv.get(key)
  const used = raw ? Number.parseInt(raw, 10) || 0 : 0
  if (used >= dailyLimit) {
    return { allowed: false, used, limit: dailyLimit, reason: 'quota_exceeded' }
  }
  return { allowed: true, used, limit: dailyLimit }
}

/** 成功生成后再扣 1 次。 */
async function commitGsClueSamplesDailyQuota(
  env: Env,
  ip: string,
  peeked: { used: number; limit: number }
): Promise<{ used: number; limit: number }> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return peeked
  }
  const key = `gs_clue_samples_ai:${ip}:${utcDayKey()}`
  const nextUsed = peeked.used + 1
  await kv.put(key, String(nextUsed), { expirationTtl: 60 * 60 * 48 })
  return { used: nextUsed, limit: peeked.limit }
}

/**
 * POST /api/ai/gs-clue-samples/complete
 */
export async function handleGsClueSamplesComplete(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin')
  const startedAt = Date.now()
  const ip = clientIp(request)

  let providerId = 'unknown'
  try {
    providerId = resolveAiChatProvider(env).id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logInfo('gs_clue_samples_rejected', {
      reason: 'ai_provider_unsupported',
      ip,
      detail: message
    })
    return errorJson({ error: 'ai_provider_unsupported' }, 503, origin)
  }

  if (!isAiChatProviderConfigured(env)) {
    logInfo('gs_clue_samples_rejected', {
      reason: 'ai_provider_not_configured',
      ip,
      providerId
    })
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  if (env.AI_GS_CLUE_SAMPLES_PROXY_ENABLED?.trim() === 'false') {
    logInfo('gs_clue_samples_rejected', { reason: 'gs_clue_samples_proxy_disabled', ip })
    return errorJson({ error: 'gs_clue_samples_proxy_disabled' }, 403, origin)
  }

  const json = request.method === 'POST' ? await request.json().catch(() => null) : null
  const bodyParsed = GsClueSamplesCompleteRequestSchema.safeParse(json ?? {})
  if (!bodyParsed.success) {
    logInfo('gs_clue_samples_rejected', { reason: 'invalid_body', ip })
    return errorJson({ error: 'invalid_body' }, 400, origin)
  }

  const { bookmark } = bodyParsed.data
  const viaAiGateway = isDeepSeekAiGatewayEnabled(env)
  logInfo('gs_clue_samples_start', {
    ip,
    providerId,
    titleLength: bookmark.title.length,
    hasUrl: Boolean(bookmark.url?.trim()),
    hasDescription: Boolean(bookmark.description?.trim()),
    viaAiGateway
  })

  const peek = await peekGsClueSamplesDailyQuota(env, ip)
  if (!peek.allowed) {
    if (peek.reason === 'kv_not_configured') {
      logInfo('gs_clue_samples_rejected', { reason: 'kv_not_configured', ip })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('gs_clue_samples_quota_exceeded', {
      ip,
      used: peek.used,
      limit: peek.limit
    })
    return errorJson(
      {
        error: 'quota_exceeded',
        used: peek.used,
        limit: peek.limit
      },
      429,
      origin
    )
  }

  try {
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      prompt: ' ',
      maxTokens: 700,
      temperature: 0.4,
      disableThinking: true,
      messages: [
        { role: 'system', content: buildGsClueSamplesSystemPrompt() },
        { role: 'user', content: buildGsClueSamplesUserPrompt(bookmark) }
      ]
    })

    const samples = parseGsClueSamplesText(result.text)
    if (!samples) {
      logInfo('gs_clue_samples_parse_failed', {
        ip,
        providerId,
        textPreview: result.text.slice(0, 160),
        durationMs: Date.now() - startedAt
      })
      return errorJson({ error: 'gs_clue_samples_parse_failed' }, 502, origin)
    }

    const quota = await commitGsClueSamplesDailyQuota(env, ip, peek)

    logInfo('gs_clue_samples_ok', {
      ip,
      durationMs: Date.now() - startedAt,
      providerId: result.providerId,
      model: result.model || resolveHostedModel(env),
      tokensUsed: result.tokensUsed,
      clueCount: samples.clues.length,
      quotaUsed: quota.used,
      quotaLimit: quota.limit,
      viaAiGateway
    })

    return okJson(
      {
        clues: samples.clues,
        provider: 'gs_clue_samples',
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
      path: '/api/ai/gs-clue-samples/complete',
      ip,
      durationMs: Date.now() - startedAt,
      providerId,
      detail: message
    })
    return errorJson({ error: 'gs_clue_samples_complete_failed' }, 500, origin)
  }
}
