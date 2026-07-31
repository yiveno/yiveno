/**
 * DeepSeek API 客户端（服务端托管）
 */

import {
  DEEPSEEK_DEFAULT_BASE_URL,
  resolveHostedModel,
  clampCompletionMaxTokens
} from '../../config/ai-hosted'
import type { Env } from '../../types/env'

export interface DeepSeekCompleteOptions {
  maxTokens?: number
  temperature?: number
  /** 关闭 V4 思考模式；结构化输出默认关闭，避免 content 为空 */
  disableThinking?: boolean
  /** Chat messages；若提供则优先于 prompt */
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}

export interface DeepSeekCompleteResult {
  text: string
  model: string
  tokensUsed?: number
}

interface DeepSeekChatResponse {
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string
      reasoning_content?: string
    }
  }>
  usage?: {
    total_tokens?: number
    prompt_tokens?: number
    completion_tokens?: number
  }
  error?: {
    message?: string
  }
}

/**
 * 调用 DeepSeek Chat Completions API
 */
export async function completeWithDeepSeek(
  env: Env,
  prompt: string,
  options?: DeepSeekCompleteOptions
): Promise<DeepSeekCompleteResult> {
  const apiKey = env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置')
  }

  const baseUrl = (env.DEEPSEEK_API_BASE?.trim() || DEEPSEEK_DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = resolveHostedModel(env)
  const maxTokens = clampCompletionMaxTokens(options?.maxTokens, 256)
  const temperature = options?.temperature ?? 0.6
  const disableThinking = options?.disableThinking !== false

  const messages =
    options?.messages && options.messages.length > 0
      ? options.messages
      : [{ role: 'user' as const, content: prompt }]

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      thinking: { type: disableThinking ? 'disabled' : 'enabled' }
    })
  })

  const payload = (await response.json().catch(() => ({}))) as DeepSeekChatResponse

  if (!response.ok) {
    const message = payload.error?.message || response.statusText || 'deepseek_request_failed'
    throw new Error(message)
  }

  const choice = payload.choices?.[0]
  const message = choice?.message
  const text = message?.content?.trim() || message?.reasoning_content?.trim()
  if (!text) {
    const finishReason = choice?.finish_reason ?? 'unknown'
    throw new Error(`deepseek_empty_response:${finishReason}`)
  }

  return {
    text,
    model,
    ...(payload.usage?.total_tokens !== undefined ? { tokensUsed: payload.usage.total_tokens } : {})
  }
}
