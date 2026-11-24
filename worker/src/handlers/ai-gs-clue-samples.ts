/**
 * Getting Started 示意 clue：扩展侧调用的结构化生成代理（key 仅在 Worker）。
 * 鉴权后按 userId 计日配额；IP 日配额保留为第二道；匿名设备 token 放行。
 * 配额仅在成功 parse 后扣减（peek-then-commit），避免模型垃圾 JSON 白烧额度。
 */

import type { Env } from '../types/env'
import { isDeepSeekAiGatewayEnabled, resolveHostedModel } from '../config/ai-hosted'
import { resolveHostedModelForTask } from '../config/ai-task-kind'
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

type QuotaPeekOk = { allowed: true; used: number; limit: number }
type QuotaPeekDenied = {
  allowed: false
  used: number
  limit: number
  reason: 'quota_exceeded' | 'kv_not_configured'
}

/** 只读探额：超限则拒绝；不写 KV。 */
async function peekGsDailyQuota(env: Env, key: string): Promise<QuotaPeekOk | QuotaPeekDenied> {
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

/** 成功生成后再扣 1 次。 */
async function commitGsDailyQuota(
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
 * POST /api/ai/gs-clue-samples/complete
 * @param isAnonymous 设备 token 路径读自 user_meta；匿名同样放行（GS 登录前会跑）
 */
export async function handleGsClueSamplesComplete(
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
    logInfo('gs_clue_samples_rejected', {
      reason: 'ai_provider_unsupported',
      userId,
      ip,
      detail: message
    })
    return errorJson({ error: 'ai_provider_unsupported' }, 503, origin)
  }

  if (!isAiChatProviderConfigured(env)) {
    logInfo('gs_clue_samples_rejected', {
      reason: 'ai_provider_not_configured',
      userId,
      ip,
      providerId
    })
    return errorJson({ error: 'ai_provider_not_configured' }, 503, origin)
  }

  if (env.AI_GS_CLUE_SAMPLES_PROXY_ENABLED?.trim() === 'false') {
    logInfo('gs_clue_samples_rejected', {
      reason: 'gs_clue_samples_proxy_disabled',
      userId,
      ip
    })
    return errorJson({ error: 'gs_clue_samples_proxy_disabled' }, 403, origin)
  }

  const json = request.method === 'POST' ? await request.json().catch(() => null) : null
  const bodyParsed = GsClueSamplesCompleteRequestSchema.safeParse(json ?? {})
  if (!bodyParsed.success) {
    logInfo('gs_clue_samples_rejected', { reason: 'invalid_body', userId, ip })
    return errorJson({ error: 'invalid_body' }, 400, origin)
  }

  const { bookmark } = bodyParsed.data
  const model = resolveHostedModelForTask(env, 'gs_samples')
  const viaAiGateway = isDeepSeekAiGatewayEnabled(env)
  const day = utcDayKey()
  const userKey = `gs_clue_samples_ai:user:${userId}:${day}`
  const ipKey = `gs_clue_samples_ai:${ip}:${day}`

  logInfo('gs_clue_samples_start', {
    userId,
    ip,
    providerId,
    model,
    titleLength: bookmark.title.length,
    hasUrl: Boolean(bookmark.url?.trim()),
    hasDescription: Boolean(bookmark.description?.trim()),
    viaAiGateway
  })

  const userPeek = await peekGsDailyQuota(env, userKey)
  if (!userPeek.allowed) {
    if (userPeek.reason === 'kv_not_configured') {
      logInfo('gs_clue_samples_rejected', { reason: 'kv_not_configured', userId, ip })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('gs_clue_samples_quota_exceeded', {
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

  const ipPeek = await peekGsDailyQuota(env, ipKey)
  if (!ipPeek.allowed) {
    if (ipPeek.reason === 'kv_not_configured') {
      logInfo('gs_clue_samples_rejected', { reason: 'kv_not_configured', userId, ip })
      return errorJson({ error: 'kv_not_configured' }, 503, origin)
    }
    logInfo('gs_clue_samples_quota_exceeded', {
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

  try {
    const provider = resolveAiChatProvider(env)
    const result = await provider.complete(env, {
      prompt: ' ',
      maxTokens: 700,
      temperature: 0.4,
      disableThinking: true,
      model,
      messages: [
        { role: 'system', content: buildGsClueSamplesSystemPrompt() },
        { role: 'user', content: buildGsClueSamplesUserPrompt(bookmark) }
      ]
    })

    const samples = parseGsClueSamplesText(result.text)
    if (!samples) {
      logInfo('gs_clue_samples_parse_failed', {
        userId,
        ip,
        providerId,
        textLength: result.text.length,
        durationMs: Date.now() - startedAt
      })
      return errorJson({ error: 'gs_clue_samples_parse_failed' }, 502, origin)
    }

    // 两道配额都按 peek-then-commit 扣费
    const userQuota = await commitGsDailyQuota(env, userKey, userPeek)
    await commitGsDailyQuota(env, ipKey, ipPeek)

    logInfo('gs_clue_samples_ok', {
      userId,
      ip,
      durationMs: Date.now() - startedAt,
      providerId: result.providerId,
      model: result.model || resolveHostedModel(env),
      tokensUsed: result.tokensUsed,
      clueCount: samples.clues.length,
      quotaUsed: userQuota.used,
      quotaLimit: userQuota.limit,
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
      path: '/api/ai/gs-clue-samples/complete',
      userId,
      ip,
      durationMs: Date.now() - startedAt,
      providerId,
      detail: message
    })
    return errorJson({ error: 'gs_clue_samples_complete_failed' }, 500, origin)
  }
}
