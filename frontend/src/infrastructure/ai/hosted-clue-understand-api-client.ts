/**
 * Pro 托管线索理解：经 `/api/ai/hosted/complete`（Bearer + 月配额）。
 */

import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import { logger } from '@/infrastructure/logging/logger'

export interface HostedCompleteApiResponse {
  text?: string
  error?: string
  model?: string
  provider?: string
  tokensUsed?: number
  quota?: {
    used?: number
    limit?: number
    remaining?: number
  }
}

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }
  return 'http://localhost:8787'
}

/**
 * 创建打 Pro 托管补全的 completer。
 * accessTokenProvider 每次请求取最新 Bearer（避免过期）。
 */
export function createHostedClueUnderstandApiCompleter(
  accessTokenProvider: () => Promise<string | null>,
  apiBaseUrl: string = resolveApiBaseUrl()
): LlmChatCompleter {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/hosted/complete`

  return async messages => {
    const accessToken = await accessTokenProvider()
    if (!accessToken) {
      throw new Error('hosted_missing_auth')
    }

    logger.info('ClueLlm', '托管请求开始', {
      url,
      messageCount: messages.length,
      maxTokens: 400
    })
    const startedAt = Date.now()

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          messages,
          maxTokens: 400,
          temperature: 0
        })
      })
    } catch (error) {
      logger.error('ClueLlm', '托管请求网络失败', {
        url,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    const payload = (await response.json().catch(() => ({}))) as HostedCompleteApiResponse
    if (!response.ok) {
      logger.warn('ClueLlm', '托管请求非 2xx', {
        url,
        status: response.status,
        durationMs: Date.now() - startedAt,
        error: payload.error ?? response.statusText
      })
      throw new Error(payload.error || response.statusText || 'hosted_complete_failed')
    }
    const text = payload.text?.trim()
    if (!text) {
      logger.warn('ClueLlm', '托管响应无 text', {
        url,
        status: response.status,
        durationMs: Date.now() - startedAt,
        model: payload.model
      })
      throw new Error('hosted_complete_empty')
    }

    logger.info('ClueLlm', '托管请求成功', {
      url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      model: payload.model,
      provider: payload.provider,
      tokensUsed: payload.tokensUsed,
      quota: payload.quota,
      textLength: text.length
    })
    return text
  }
}
