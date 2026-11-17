/**
 * Recall 线索理解：经 Cloudflare Worker 代理 DeepSeek（扩展不持有 API Key）。
 * 失败抛 `HostedCompleteError`（带 kind），与 hosted client 对称；UI 只读 kind。
 */

import { resolveClientMaxTokensForTask } from '@/core/recall/understand/ai-chat-task-kind'
import type { LlmChatCompleteOptions } from '@/core/recall/understand/ai-chat-task-kind'
import {
  classifyClueLlmFailure,
  HostedCompleteError
} from '@/core/recall/understand/clue-llm-failure-kind'
import { CLUE_LLM_COMPLETE_TIMEOUT_MS } from '@/core/recall/understand/clue-llm-timeout'
import {
  parseLlmChatUsage,
  type LlmChatDetailedResult
} from '@/core/recall/understand/llm-chat-usage'
import type {
  LlmChatCompleter,
  LlmChatCompleterDetailed
} from '@/core/recall/understand/parse-recall-clue-with-llm'
import { logger } from '@/infrastructure/logging/logger'

export interface ClueCompleteApiResponse {
  text?: string
  error?: string
  model?: string
  provider?: string
  taskKind?: string
  tokensUsed?: number
  promptTokens?: number
  completionTokens?: number
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

async function requestClueCompleteDetailed(
  url: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: LlmChatCompleteOptions
): Promise<LlmChatDetailedResult> {
  const taskKind = options.taskKind
  const maxTokens = resolveClientMaxTokensForTask(taskKind)
  logger.info('ClueLlm', '代理请求开始', {
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages,
        maxTokens,
        temperature: options.temperature ?? 0,
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
      logger.warn('ClueLlm', '代理请求超时，将降级规则理解', {
        url,
        taskKind,
        durationMs,
        timeoutMs: CLUE_LLM_COMPLETE_TIMEOUT_MS,
        outcome: 'timeout'
      })
      throw new HostedCompleteError('timeout', 'clue_complete_timeout')
    }
    logger.error('ClueLlm', '代理请求网络失败', {
      url,
      taskKind,
      durationMs,
      outcome: 'network_error',
      error: error instanceof Error ? error.message : String(error)
    })
    // 网络失败显式标 network；不经 classify 猜（无 status 时 classify 只给 unknown）
    throw new HostedCompleteError(
      'network',
      error instanceof Error ? error.message : 'clue_complete_network'
    )
  }

  const payload = (await response.json().catch(() => ({}))) as ClueCompleteApiResponse
  if (!response.ok) {
    const workerError = typeof payload.error === 'string' ? payload.error : undefined
    // clue 端点配额按 IP 按天（429 + quota_exceeded）；分类器同字段会误判为 quota_monthly。
    // 无 dailyUsed/dailyLimit 快照字段 → 不带 quota，UI 走 quota_daily_no_numbers。
    let kind
    if (response.status === 429 && workerError === 'quota_exceeded') {
      kind = 'quota_daily' as const
    } else {
      kind = classifyClueLlmFailure({
        status: response.status,
        ...(workerError !== undefined ? { workerError } : {})
      })
    }
    logger.warn('ClueLlm', '代理请求非 2xx', {
      url,
      taskKind,
      status: response.status,
      durationMs: Date.now() - startedAt,
      error: payload.error ?? response.statusText,
      outcome: response.status === 429 ? 'quota' : 'http_error',
      failureKind: kind
    })
    throw new HostedCompleteError(
      kind,
      workerError || response.statusText || 'clue_complete_failed',
      {
        status: response.status
      }
    )
  }
  const text = payload.text?.trim()
  if (!text) {
    logger.warn('ClueLlm', '代理响应无 text', {
      url,
      taskKind,
      status: response.status,
      durationMs: Date.now() - startedAt,
      model: payload.model,
      keys: Object.keys(payload)
    })
    throw new HostedCompleteError('empty_response', 'clue_complete_empty', {
      status: response.status
    })
  }

  const usage = parseLlmChatUsage(payload)
  logger.info('ClueLlm', '代理请求成功', {
    url,
    taskKind,
    status: response.status,
    durationMs: Date.now() - startedAt,
    model: payload.model,
    provider: payload.provider,
    tokensUsed: payload.tokensUsed,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    quota: payload.quota,
    textLength: text.length,
    outcome: 'ok'
  })
  return { text, usage }
}

/**
 * 创建打 `/api/ai/clue/complete` 的 completer。
 * Background SW 不受 CORS 限制；失败由调用方降级规则。
 * 请求体带 taskKind，供服务端观测与模型路由。
 */
export function createClueUnderstandApiCompleter(
  apiBaseUrl: string = resolveApiBaseUrl()
): LlmChatCompleter {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/clue/complete`
  return async (messages, options) => {
    const detailed = await requestClueCompleteDetailed(url, messages, options)
    return detailed.text
  }
}

/** IP 配额 detailed 入口：透传 Worker 拆分的 prompt/completion token。 */
export function createClueUnderstandApiCompleterDetailed(
  apiBaseUrl: string = resolveApiBaseUrl()
): LlmChatCompleterDetailed {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/clue/complete`
  return (messages, options) => requestClueCompleteDetailed(url, messages, options)
}

export { resolveApiBaseUrl }
