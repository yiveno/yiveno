/**
 * Recall 线索理解：经 Cloudflare Worker 代理 DeepSeek（扩展不持有 API Key）。
 */

import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import { logger } from '@/infrastructure/logging/logger'

export interface ClueCompleteApiResponse {
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
 * 创建打 `/api/ai/clue/complete` 的 completer。
 * Background SW 不受 CORS 限制；失败由调用方降级规则。
 */
export function createClueUnderstandApiCompleter(
  apiBaseUrl: string = resolveApiBaseUrl()
): LlmChatCompleter {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/clue/complete`

  return async messages => {
    logger.info('ClueLlm', '代理请求开始', {
      url,
      messageCount: messages.length,
      maxTokens: 400
    })
    const startedAt = Date.now()

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages,
          maxTokens: 400,
          temperature: 0
        })
      })
    } catch (error) {
      logger.error('ClueLlm', '代理请求网络失败', {
        url,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    const payload = (await response.json().catch(() => ({}))) as ClueCompleteApiResponse
    if (!response.ok) {
      logger.warn('ClueLlm', '代理请求非 2xx', {
        url,
        status: response.status,
        durationMs: Date.now() - startedAt,
        error: payload.error ?? response.statusText
      })
      throw new Error(payload.error || response.statusText || 'clue_complete_failed')
    }
    const text = payload.text?.trim()
    if (!text) {
      logger.warn('ClueLlm', '代理响应无 text', {
        url,
        status: response.status,
        durationMs: Date.now() - startedAt,
        model: payload.model,
        keys: Object.keys(payload)
      })
      throw new Error('clue_complete_empty')
    }

    logger.info('ClueLlm', '代理请求成功', {
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

export { resolveApiBaseUrl }
