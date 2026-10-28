/**
 * 托管线索理解：经 `/api/ai/hosted/complete`（Bearer；Free/Pro 月+日配额）。
 */

import { resolveClientMaxTokensForTask } from '@/core/recall/understand/ai-chat-task-kind'
import { CLUE_LLM_COMPLETE_TIMEOUT_MS } from '@/core/recall/understand/clue-llm-timeout'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import { logger } from '@/infrastructure/logging/logger'

export interface HostedCompleteApiResponse {
  text?: string
  error?: string
  model?: string
  provider?: string
  taskKind?: string
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
 * 创建打托管补全的 completer（登录 Free/Pro；配额用尽抛错，上层降级规则）。
 * accessTokenProvider 每次请求取最新 Bearer（避免过期）。
 * 请求体带 taskKind，供服务端观测与模型路由。
 */
export function createHostedClueUnderstandApiCompleter(
  accessTokenProvider: () => Promise<string | null>,
  apiBaseUrl: string = resolveApiBaseUrl()
): LlmChatCompleter {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/hosted/complete`

  return async (messages, options) => {
    const accessToken = await accessTokenProvider()
    if (!accessToken) {
      throw new Error('hosted_missing_auth')
    }

    const taskKind = options.taskKind
    const maxTokens = resolveClientMaxTokensForTask(taskKind)
    logger.info('ClueLlm', '托管请求开始', {
      url,
      taskKind,
      messageCount: messages.length,
      maxTokens
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
          maxTokens,
          temperature: 0,
          taskKind
        }),
        signal: AbortSignal.timeout(CLUE_LLM_COMPLETE_TIMEOUT_MS)
      })
    } catch (error) {
      const durationMs = Date.now() - startedAt
      const aborted =
        (error instanceof DOMException && error.name === 'TimeoutError') ||
        (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
      if (aborted) {
        logger.warn('ClueLlm', '托管请求超时，将降级规则理解', {
          url,
          taskKind,
          durationMs,
          timeoutMs: CLUE_LLM_COMPLETE_TIMEOUT_MS,
          outcome: 'timeout'
        })
      } else {
        logger.error('ClueLlm', '托管请求网络失败', {
          url,
          taskKind,
          durationMs,
          outcome: 'network_error',
          error: error instanceof Error ? error.message : String(error)
        })
      }
      throw error
    }

    const payload = (await response.json().catch(() => ({}))) as HostedCompleteApiResponse
    if (!response.ok) {
      logger.warn('ClueLlm', '托管请求非 2xx', {
        url,
        taskKind,
        status: response.status,
        durationMs: Date.now() - startedAt,
        error: payload.error ?? response.statusText,
        outcome: response.status === 429 ? 'quota' : 'http_error'
      })
      throw new Error(payload.error || response.statusText || 'hosted_complete_failed')
    }
    const text = payload.text?.trim()
    if (!text) {
      logger.warn('ClueLlm', '托管响应无 text', {
        url,
        taskKind,
        status: response.status,
        durationMs: Date.now() - startedAt,
        model: payload.model
      })
      throw new Error('hosted_complete_empty')
    }

    logger.info('ClueLlm', '托管请求成功', {
      url,
      taskKind,
      status: response.status,
      durationMs: Date.now() - startedAt,
      model: payload.model,
      provider: payload.provider,
      tokensUsed: payload.tokensUsed,
      quota: payload.quota,
      textLength: text.length,
      outcome: 'ok'
    })
    return text
  }
}
