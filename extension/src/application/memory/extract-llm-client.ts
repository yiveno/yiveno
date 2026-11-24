/**
 * 内容提炼专用 LLM 客户端：POST /api/ai/extract/complete（peek-then-commit）。
 * 429 / 403 静默跳过；其余失败不重试。
 */

import { z } from 'zod'

import { logger } from '@/infrastructure/logging/logger'

const ExtractCompleteResponseSchema = z.object({
  summary: z.string().min(1),
  model: z.string().optional(),
  error: z.string().optional(),
  deferred: z.boolean().optional()
})

export type ExtractClientResult =
  | { ok: true; summary: string; model: string | null }
  | { ok: false; skipped: true; errorCode: string }
  | { ok: false; skipped: false; errorCode: string }

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }
  return 'http://localhost:8787'
}

/**
 * 请求单页摘要。accessToken 由调用方传入（调度门已确认有票）。
 */
export async function requestPageExtractSummary(input: {
  accessToken: string
  url: string
  title?: string
  text: string
}): Promise<ExtractClientResult> {
  const url = `${resolveApiBaseUrl()}/api/ai/extract/complete`
  logger.info('ContentExtract', '提炼请求开始', {
    urlHost: (() => {
      try {
        return new URL(input.url).hostname
      } catch {
        return null
      }
    })(),
    textLength: input.text.length
  })

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.accessToken}`
      },
      body: JSON.stringify({
        url: input.url,
        text: input.text,
        ...(input.title ? { title: input.title } : {})
      }),
      signal: AbortSignal.timeout(60_000)
    })
  } catch (error) {
    logger.warn('ContentExtract', '提炼网络失败（不重试）', {
      error: error instanceof Error ? error.message : String(error)
    })
    return { ok: false, skipped: false, errorCode: 'network_error' }
  }

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (response.status === 429 || response.status === 403) {
    const errorCode = typeof raw.error === 'string' ? raw.error : `http_${response.status}`
    logger.info('ContentExtract', '提炼静默跳过', {
      status: response.status,
      errorCode
    })
    return { ok: false, skipped: true, errorCode }
  }
  if (!response.ok) {
    const errorCode = typeof raw.error === 'string' ? raw.error : `http_${response.status}`
    logger.warn('ContentExtract', '提炼失败（不重试）', {
      status: response.status,
      errorCode
    })
    return { ok: false, skipped: false, errorCode }
  }

  const parsed = ExtractCompleteResponseSchema.safeParse(raw)
  if (!parsed.success) {
    logger.warn('ContentExtract', '提炼响应 schema 失败', {
      issues: parsed.error.issues.slice(0, 3)
    })
    return { ok: false, skipped: false, errorCode: 'invalid_response' }
  }

  return {
    ok: true,
    summary: parsed.data.summary.trim(),
    model: parsed.data.model ?? null
  }
}
