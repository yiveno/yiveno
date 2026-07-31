/**
 * Recall 线索理解：经 Cloudflare Worker 代理 DeepSeek（扩展不持有 API Key）。
 */

import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

export interface ClueCompleteApiResponse {
  text?: string
  error?: string
  model?: string
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

  return async messages => {
    const response = await fetch(`${base}/api/ai/clue/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages,
        maxTokens: 400,
        temperature: 0
      })
    })

    const payload = (await response.json().catch(() => ({}))) as ClueCompleteApiResponse
    if (!response.ok) {
      throw new Error(payload.error || response.statusText || 'clue_complete_failed')
    }
    const text = payload.text?.trim()
    if (!text) {
      throw new Error('clue_complete_empty')
    }
    return text
  }
}

export { resolveApiBaseUrl }
