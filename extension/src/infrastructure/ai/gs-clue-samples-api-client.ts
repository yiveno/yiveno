/**
 * Getting Started 示意 clue：经 Cloudflare Worker 一次生成 4 条口语线索。
 */

import { resolveApiBaseUrl } from '@/infrastructure/ai/clue-understand-api-client'
import { logger } from '@/infrastructure/logging/logger'
import type { GsClueSampleSource } from '@/core/onboarding/gs-clue-samples'

export type OnboardingCompleteResult = {
  clues: string[]
  model?: string
  providerId?: string
  tokensUsed?: number
}

type ApiResponse = {
  clues?: Array<{ text?: string } | string>
  error?: string
  model?: string
  providerId?: string
  tokensUsed?: number
}

function normalizeClues(raw: ApiResponse['clues']): string[] | null {
  if (!Array.isArray(raw) || raw.length !== 4) {
    return null
  }
  const out: string[] = []
  for (const item of raw) {
    const text = typeof item === 'string' ? item.trim() : item?.text?.trim()
    if (!text || text.length < 8) {
      return null
    }
    out.push(text.replace(/\s+/g, ' ').slice(0, 280))
  }
  return out
}

/**
 * 请求 `/api/ai/gs-clue-samples/complete`；失败抛错，由调用方回退模板。
 */
export async function requestGettingStartedClueSamples(
  bookmark: Pick<GsClueSampleSource, 'title' | 'url' | 'description'>,
  apiBaseUrl: string = resolveApiBaseUrl()
): Promise<OnboardingCompleteResult> {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/gs-clue-samples/complete`

  logger.info('Onboarding', '示意 clue 请求开始', {
    url,
    titlePreview: bookmark.title.slice(0, 48),
    hasUrl: Boolean(bookmark.url?.trim()),
    hasDescription: Boolean(bookmark.description?.trim())
  })
  const startedAt = Date.now()

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bookmark: {
          title: bookmark.title,
          ...(bookmark.url?.trim() ? { url: bookmark.url.trim() } : {}),
          ...(bookmark.description?.trim() ? { description: bookmark.description.trim() } : {})
        }
      })
    })
  } catch (error) {
    logger.error('Onboarding', '示意 clue 网络失败', {
      url,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }

  const payload = (await response.json().catch(() => ({}))) as ApiResponse
  if (!response.ok) {
    logger.warn('Onboarding', '示意 clue 非 2xx', {
      url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      error: payload.error ?? response.statusText
    })
    throw new Error(payload.error || response.statusText || 'gs_clue_samples_complete_failed')
  }

  const clues = normalizeClues(payload.clues)
  if (!clues) {
    logger.warn('Onboarding', '示意 clue 响应未通过校验', {
      url,
      durationMs: Date.now() - startedAt,
      model: payload.model
    })
    throw new Error('gs_clue_samples_invalid')
  }

  logger.info('Onboarding', '示意 clue 请求成功', {
    url,
    status: response.status,
    durationMs: Date.now() - startedAt,
    model: payload.model,
    providerId: payload.providerId,
    tokensUsed: payload.tokensUsed,
    clueCount: clues.length
  })

  return {
    clues,
    ...(payload.model !== undefined ? { model: payload.model } : {}),
    ...(payload.providerId !== undefined ? { providerId: payload.providerId } : {}),
    ...(payload.tokensUsed !== undefined ? { tokensUsed: payload.tokensUsed } : {})
  }
}
