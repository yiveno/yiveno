/**
 * 托管线索理解：经 `/api/ai/hosted/complete`（Bearer；Free/Pro 月+日配额）。
 * 失败抛 `HostedCompleteError`（带 kind），供 UI 诚实归因；日志文案保持原口径。
 */

import { resolveClientMaxTokensForTask } from '@/core/recall/understand/ai-chat-task-kind'
import { CLUE_LLM_COMPLETE_TIMEOUT_MS } from '@/core/recall/understand/clue-llm-timeout'
import {
  classifyClueLlmFailure,
  HostedCompleteError,
  type ClueLlmFailureQuotaSnapshot
} from '@/core/recall/understand/clue-llm-failure-kind'
import {
  parseLlmChatUsage,
  type LlmChatDetailedResult
} from '@/core/recall/understand/llm-chat-usage'
import type {
  LlmChatCompleter,
  LlmChatCompleterDetailed
} from '@/core/recall/understand/parse-recall-clue-with-llm'
import type { LlmChatCompleteOptions } from '@/core/recall/understand/ai-chat-task-kind'
import { logger } from '@/infrastructure/logging/logger'

export interface HostedCompleteApiResponse {
  text?: string
  error?: string
  model?: string
  provider?: string
  taskKind?: string
  tokensUsed?: number
  promptTokens?: number
  completionTokens?: number
  /** 429 路径：free | pro | anonymous（匿名试用终身档分流）。 */
  tier?: string
  /** 成功路径偶发嵌套配额；429 失败路径 Worker 用顶层 used/limit/daily*。 */
  quota?: {
    used?: number
    limit?: number
    remaining?: number
    dailyUsed?: number
    dailyLimit?: number
  }
  used?: number
  limit?: number
  dailyUsed?: number
  dailyLimit?: number
}

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }
  return 'http://localhost:8787'
}

/** 从 Worker 429 响应抽取配额快照；缺字段则不返回（UI 退回无数字文案）。 */
function readQuotaSnapshot(
  payload: HostedCompleteApiResponse
): ClueLlmFailureQuotaSnapshot | undefined {
  const used = payload.used ?? payload.quota?.used
  const limit = payload.limit ?? payload.quota?.limit
  const dailyUsed = payload.dailyUsed ?? payload.quota?.dailyUsed
  const dailyLimit = payload.dailyLimit ?? payload.quota?.dailyLimit
  if (
    typeof used !== 'number' ||
    typeof limit !== 'number' ||
    typeof dailyUsed !== 'number' ||
    typeof dailyLimit !== 'number'
  ) {
    return undefined
  }
  return { used, limit, dailyUsed, dailyLimit }
}

async function requestHostedCompleteDetailed(
  url: string,
  accessTokenProvider: () => Promise<string | null>,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: LlmChatCompleteOptions
): Promise<LlmChatDetailedResult> {
  const accessToken = await accessTokenProvider()
  if (!accessToken) {
    throw new HostedCompleteError('auth', 'hosted_missing_auth')
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
      logger.warn('ClueLlm', '托管请求超时，将降级规则理解', {
        url,
        taskKind,
        durationMs,
        timeoutMs: CLUE_LLM_COMPLETE_TIMEOUT_MS,
        outcome: 'timeout'
      })
      throw new HostedCompleteError('timeout', 'hosted_complete_timeout')
    }
    logger.error('ClueLlm', '托管请求网络失败', {
      url,
      taskKind,
      durationMs,
      outcome: 'network_error',
      error: error instanceof Error ? error.message : String(error)
    })
    // 网络失败显式标 network；不经 classify 猜（无 status 时 classify 只给 unknown）
    throw new HostedCompleteError(
      'network',
      error instanceof Error ? error.message : 'hosted_complete_network'
    )
  }

  const payload = (await response.json().catch(() => ({}))) as HostedCompleteApiResponse
  if (!response.ok) {
    const workerError = typeof payload.error === 'string' ? payload.error : undefined
    const tier = typeof payload.tier === 'string' ? payload.tier : undefined
    const kind = classifyClueLlmFailure({
      status: response.status,
      ...(workerError !== undefined ? { workerError } : {}),
      ...(tier !== undefined ? { tier } : {})
    })
    logger.warn('ClueLlm', '托管请求非 2xx', {
      url,
      taskKind,
      status: response.status,
      durationMs: Date.now() - startedAt,
      error: payload.error ?? response.statusText,
      ...(tier !== undefined ? { tier } : {}),
      outcome: response.status === 429 ? 'quota' : 'http_error',
      failureKind: kind
    })
    const quota =
      kind === 'quota_monthly' || kind === 'quota_daily' || kind === 'anonymous_quota_exhausted'
        ? readQuotaSnapshot(payload)
        : undefined
    throw new HostedCompleteError(
      kind,
      workerError || response.statusText || 'hosted_complete_failed',
      {
        status: response.status,
        ...(quota ? { quota } : {})
      }
    )
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
    throw new HostedCompleteError('empty_response', 'hosted_complete_empty', {
      status: response.status
    })
  }

  const usage = parseLlmChatUsage(payload)
  logger.info('ClueLlm', '托管请求成功', {
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
  return {
    text,
    usage,
    ...(payload.model !== undefined ? { model: payload.model } : {})
  }
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
    const detailed = await requestHostedCompleteDetailed(
      url,
      accessTokenProvider,
      messages,
      options
    )
    return detailed.text
  }
}

/** 托管 detailed 入口：透传 Worker 拆分的 prompt/completion token。 */
export function createHostedClueUnderstandApiCompleterDetailed(
  accessTokenProvider: () => Promise<string | null>,
  apiBaseUrl: string = resolveApiBaseUrl()
): LlmChatCompleterDetailed {
  const base = apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/ai/hosted/complete`
  return (messages, options) =>
    requestHostedCompleteDetailed(url, accessTokenProvider, messages, options)
}
