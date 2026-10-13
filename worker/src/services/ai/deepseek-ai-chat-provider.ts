/**
 * DeepSeek Chat Completions adapter（第一个 AiChatProvider 实现）。
 *
 * 默认经 Cloudflare AI Gateway 转发；未配置 Gateway 时直连 api.deepseek.com。
 * Gateway 若开启 Authenticated Gateway，需 Secret `AI_GATEWAY_TOKEN` → 头 `cf-aig-authorization`。
 */

import {
  DEEPSEEK_DEFAULT_BASE_URL,
  resolveDeepSeekChatCompletionsUrl,
  isDeepSeekAiGatewayEnabled,
  resolveHostedModel,
  clampCompletionMaxTokens
} from '../../config/ai-hosted'
import type { Env } from '../../types/env'
import type {
  AiChatCompleteRequest,
  AiChatCompleteResult,
  AiChatMessage,
  AiChatProvider
} from './ai-chat-provider'

const PROVIDER_ID = 'deepseek'

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
  }
  error?: {
    message?: string
  }
}

function buildChatBody(
  model: string,
  messages: AiChatMessage[],
  maxTokens: number,
  temperature: number,
  disableThinking: boolean
): string {
  return JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    thinking: { type: disableThinking ? 'disabled' : 'enabled' }
  })
}

function buildAuthHeaders(env: Env, apiKey: string, viaGateway: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    'user-agent': viaGateway
      ? 'yiveno-worker/deepseek-via-aigateway'
      : 'yiveno-worker/deepseek-direct'
  }
  const gatewayToken = env.AI_GATEWAY_TOKEN?.trim()
  if (viaGateway && gatewayToken) {
    headers['cf-aig-authorization'] = `Bearer ${gatewayToken}`
  }
  return headers
}

function formatUpstreamError(
  viaGateway: boolean,
  status: number,
  message: string,
  hasGatewayToken: boolean
): string {
  if (viaGateway && status === 401) {
    if (!hasGatewayToken) {
      return (
        'ai_gateway_unauthorized: Gateway 开启了 Authenticated Gateway，但未配置 AI_GATEWAY_TOKEN。' +
        '请在 Dashboard 关闭鉴权，或创建 Run token 写入 Secret AI_GATEWAY_TOKEN（头 cf-aig-authorization）。'
      )
    }
    return `ai_gateway_unauthorized: ${message}（检查 AI_GATEWAY_TOKEN 是否有效）`
  }
  return message || 'deepseek_request_failed'
}

function resolveMessages(request: AiChatCompleteRequest): AiChatMessage[] {
  if (request.messages && request.messages.length > 0) {
    return request.messages
  }
  const prompt = request.prompt?.trim() ?? ''
  return [{ role: 'user', content: prompt || ' ' }]
}

export const deepseekAiChatProvider: AiChatProvider = {
  id: PROVIDER_ID,

  isConfigured(env: Env): boolean {
    return Boolean(env.DEEPSEEK_API_KEY?.trim())
  },

  async complete(env: Env, request: AiChatCompleteRequest): Promise<AiChatCompleteResult> {
    const apiKey = env.DEEPSEEK_API_KEY?.trim()
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置')
    }

    const viaGateway = isDeepSeekAiGatewayEnabled(env)
    const completionsUrl = resolveDeepSeekChatCompletionsUrl(env)
    const model = resolveHostedModel(env)
    const maxTokens = clampCompletionMaxTokens(request.maxTokens, 256)
    const temperature = request.temperature ?? 0.6
    const disableThinking = request.disableThinking !== false
    const hasGatewayToken = Boolean(env.AI_GATEWAY_TOKEN?.trim())
    const messages = resolveMessages(request)
    const body = buildChatBody(model, messages, maxTokens, temperature, disableThinking)

    let response = await fetch(completionsUrl, {
      method: 'POST',
      headers: buildAuthHeaders(env, apiKey, viaGateway),
      body
    })

    // Gateway 鉴权开了但未配 CF token：回退直连，避免本地线索理解整段挂死
    if (viaGateway && response.status === 401 && !hasGatewayToken) {
      const directUrl = `${DEEPSEEK_DEFAULT_BASE_URL}/v1/chat/completions`
      response = await fetch(directUrl, {
        method: 'POST',
        headers: buildAuthHeaders(env, apiKey, false),
        body
      })
      if (!response.ok) {
        const failPayload = (await response.json().catch(() => ({}))) as DeepSeekChatResponse
        const failMessage =
          failPayload.error?.message || response.statusText || 'deepseek_request_failed'
        throw new Error(
          formatUpstreamError(true, 401, failMessage, false) + `；直连回退亦失败: ${failMessage}`
        )
      }
    } else if (!response.ok) {
      const failPayload = (await response.json().catch(() => ({}))) as DeepSeekChatResponse
      const failMessage =
        failPayload.error?.message || response.statusText || 'deepseek_request_failed'
      throw new Error(
        formatUpstreamError(viaGateway, response.status, failMessage, hasGatewayToken)
      )
    }

    const payload = (await response.json().catch(() => ({}))) as DeepSeekChatResponse
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
      providerId: PROVIDER_ID,
      ...(payload.usage?.total_tokens !== undefined
        ? { tokensUsed: payload.usage.total_tokens }
        : {})
    }
  }
}

/**
 * 兼容旧调用点：委托给 deepseekAiChatProvider。
 * 新代码请优先 resolveAiChatProvider(env).complete(...)。
 */
export async function completeWithDeepSeek(
  env: Env,
  prompt: string,
  options?: {
    maxTokens?: number
    temperature?: number
    disableThinking?: boolean
    messages?: AiChatMessage[]
  }
): Promise<{ text: string; model: string; tokensUsed?: number }> {
  const result = await deepseekAiChatProvider.complete(env, {
    prompt,
    ...(options?.messages ? { messages: options.messages } : {}),
    ...(options?.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
    ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options?.disableThinking !== undefined ? { disableThinking: options.disableThinking } : {})
  })
  return {
    text: result.text,
    model: result.model,
    ...(result.tokensUsed !== undefined ? { tokensUsed: result.tokensUsed } : {})
  }
}
