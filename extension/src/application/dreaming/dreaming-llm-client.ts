/**
 * Dreaming 专用 LLM 客户端：POST /api/ai/dreaming/complete（peek-then-commit）。
 * 失败不重试；429 deferred 留给下次 run。
 */

import { z } from 'zod'

import { DREAMING_COMPILE_BATCH_SIZE } from '@/core/dreaming/dreaming-constants'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { logger } from '@/infrastructure/logging/logger'

const PropositionSchema = z.object({
  text: z.string().min(1),
  sourceQuote: z.string().min(1),
  topicAnchor: z.array(z.string()).optional()
})

const ResultRowSchema = z.object({
  sourceId: z.string().uuid(),
  propositions: z.array(PropositionSchema)
})

const DreamingCompleteResponseSchema = z.object({
  results: z.array(ResultRowSchema),
  model: z.string().optional(),
  error: z.string().optional(),
  deferred: z.boolean().optional()
})

export type DreamingCompileSourceInput = {
  id: string
  type: 'bookmark' | 'text_excerpt'
  title?: string
  text: string
  note?: string
}

export type DreamingCompileClientResult =
  | {
      ok: true
      results: Array<{
        sourceId: string
        propositions: Array<{ text: string; sourceQuote: string; topicAnchor: string[] }>
      }>
      model: string | null
    }
  | { ok: false; deferred: true; errorCode: string }
  | { ok: false; deferred: false; errorCode: string }

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }
  return 'http://localhost:8787'
}

/**
 * 批量编译命题。sources 长度须 ∈ [1, DREAMING_COMPILE_BATCH_SIZE]。
 */
export async function requestDreamingCompileBatch(
  sources: readonly DreamingCompileSourceInput[]
): Promise<DreamingCompileClientResult> {
  if (sources.length < 1 || sources.length > DREAMING_COMPILE_BATCH_SIZE) {
    return { ok: false, deferred: false, errorCode: 'invalid_batch_size' }
  }

  const session = await getAuthSession()
  const accessToken = session?.accessToken?.trim()
  if (!accessToken) {
    logger.info('Dreaming', '编译跳过：未登录', { sourceCount: sources.length })
    return { ok: false, deferred: true, errorCode: 'not_signed_in' }
  }

  const url = `${resolveApiBaseUrl()}/api/ai/dreaming/complete`
  logger.info('Dreaming', '编译请求开始', {
    url,
    sourceCount: sources.length
  })

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        sources: sources.map(source => ({
          id: source.id,
          type: source.type,
          text: source.text,
          ...(source.title ? { title: source.title } : {}),
          ...(source.note ? { note: source.note } : {})
        }))
      }),
      signal: AbortSignal.timeout(60_000)
    })
  } catch (error) {
    logger.warn('Dreaming', '编译网络失败（不重试）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return { ok: false, deferred: false, errorCode: 'network_error' }
  }

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (response.status === 429) {
    const errorCode = typeof raw.error === 'string' ? raw.error : 'dreaming_quota_exceeded'
    logger.info('Dreaming', '编译延后：配额不足', {
      errorCode,
      deferred: true
    })
    return { ok: false, deferred: true, errorCode }
  }
  if (!response.ok) {
    const errorCode = typeof raw.error === 'string' ? raw.error : `http_${response.status}`
    logger.warn('Dreaming', '编译失败（不重试、不扣本地游标）', {
      status: response.status,
      errorCode
    })
    return { ok: false, deferred: false, errorCode }
  }

  const parsed = DreamingCompleteResponseSchema.safeParse(raw)
  if (!parsed.success) {
    logger.warn('Dreaming', '编译响应 schema 失败', {
      issues: parsed.error.issues.slice(0, 3)
    })
    return { ok: false, deferred: false, errorCode: 'invalid_response' }
  }

  return {
    ok: true,
    model: parsed.data.model ?? null,
    results: parsed.data.results.map(row => ({
      sourceId: row.sourceId,
      propositions: row.propositions.map(prop => ({
        text: prop.text,
        sourceQuote: prop.sourceQuote,
        topicAnchor: prop.topicAnchor ?? []
      }))
    }))
  }
}
