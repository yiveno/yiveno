/**
 * Cloudflare AI Gateway OpenAI-compat adapter（第二个 AiChatProvider 实现）。
 *
 * 经 Gateway `/compat/chat/completions`，用 `{provider}/{model}` 串切换厂商。
 * 生产默认仍为 deepseek 原生 adapter；本实现仅在 `AI_PROVIDER=gateway-compat` 时启用。
 *
 * 刻意选择：temperature 缺省为 0（结构化任务优先确定性），
 * 与 DeepSeek 原生 adapter 的 0.6 缺省不同。
 *
 * 恒发 `cf-aig-collect-log-payload: false` 与 `cf-aig-skip-cache: true`。
 * 缺 Gateway env / 无厂商前缀 / 缺对应 API key 时抛明确错误，不静默直连、不回退 DeepSeek。
 */

import {
  AI_GATEWAY_DEFAULT_HOST,
  clampCompletionMaxTokens,
  resolveHostedModel
} from '../../config/ai-hosted'
import type { Env } from '../../types/env'
import type {
  AiChatCompleteRequest,
  AiChatCompleteResult,
  AiChatMessage,
  AiChatProvider
} from './ai-chat-provider'

const PROVIDER_ID = 'gateway-compat'

/** compat 端点支持的厂商前缀 → 对应 Secret 键名 */
type CompatVendor = 'deepseek' | 'openai' | 'google-ai-studio'

const VENDOR_API_KEY_ENV: Record<CompatVendor, keyof Env> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  'google-ai-studio': 'GOOGLE_AI_API_KEY'
}

interface CompatChatResponse {
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string
      reasoning_content?: string
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: {
    message?: string
  }
}

function resolveMessages(request: AiChatCompleteRequest): AiChatMessage[] {
  if (request.messages && request.messages.length > 0) {
    return request.messages
  }
  const prompt = request.prompt?.trim() ?? ''
  return [{ role: 'user', content: prompt || ' ' }]
}

function parseVendorPrefix(model: string): CompatVendor {
  const slash = model.indexOf('/')
  if (slash <= 0) {
    throw new Error(
      `gateway_compat_model_missing_provider_prefix: 模型名须含厂商前缀（如 deepseek/deepseek-flash），收到「${model}」`
    )
  }
  const prefix = model.slice(0, slash)
  if (prefix === 'deepseek' || prefix === 'openai' || prefix === 'google-ai-studio') {
    return prefix
  }
  throw new Error(
    `gateway_compat_unsupported_provider_prefix: 不支持前缀「${prefix}」（支持 deepseek / openai / google-ai-studio）`
  )
}

function resolveCompatCompletionsUrl(env: Env): string {
  const accountId = env.AI_GATEWAY_ACCOUNT_ID?.trim()
  const gatewayId = env.AI_GATEWAY_ID?.trim()
  if (!accountId || !gatewayId) {
    throw new Error(
      'gateway_compat_misconfigured: 需要 AI_GATEWAY_ACCOUNT_ID 与 AI_GATEWAY_ID，缺任一时不可调用（不直连、不回退 DeepSeek）'
    )
  }
  return `${AI_GATEWAY_DEFAULT_HOST}/v1/${accountId}/${gatewayId}/compat/chat/completions`
}

function resolveApiKey(env: Env, vendor: CompatVendor): string {
  const envKey = VENDOR_API_KEY_ENV[vendor]
  const apiKey = (env[envKey] as string | undefined)?.trim()
  if (!apiKey) {
    throw new Error(`gateway_compat_api_key_missing: 厂商 ${vendor} 需要配置 ${String(envKey)}`)
  }
  return apiKey
}

function buildChatBody(
  vendor: CompatVendor,
  model: string,
  messages: AiChatMessage[],
  maxTokens: number,
  temperature: number,
  disableThinking: boolean
): string {
  const base = {
    model,
    messages,
    temperature
  }

  if (vendor === 'openai') {
    const body: Record<string, unknown> = {
      ...base,
      max_completion_tokens: maxTokens
    }
    if (disableThinking) {
      body.reasoning_effort = 'none'
    }
    return JSON.stringify(body)
  }

  if (vendor === 'deepseek') {
    return JSON.stringify({
      ...base,
      max_tokens: maxTokens,
      thinking: { type: disableThinking ? 'disabled' : 'enabled' }
    })
  }

  // google-ai-studio：不发 thinking / reasoning 字段
  return JSON.stringify({
    ...base,
    max_tokens: maxTokens
  })
}

function buildAuthHeaders(env: Env, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    'user-agent': 'yiveno-worker/gateway-compat',
    'cf-aig-collect-log-payload': 'false',
    'cf-aig-skip-cache': 'true'
  }
  const gatewayToken = env.AI_GATEWAY_TOKEN?.trim()
  if (gatewayToken) {
    headers['cf-aig-authorization'] = `Bearer ${gatewayToken}`
  }
  return headers
}

export const gatewayCompatAiChatProvider: AiChatProvider = {
  id: PROVIDER_ID,

  isConfigured(env: Env): boolean {
    const hasGateway = Boolean(env.AI_GATEWAY_ACCOUNT_ID?.trim() && env.AI_GATEWAY_ID?.trim())
    if (!hasGateway) return false
    return Boolean(
      env.DEEPSEEK_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || env.GOOGLE_AI_API_KEY?.trim()
    )
  },

  async complete(env: Env, request: AiChatCompleteRequest): Promise<AiChatCompleteResult> {
    const completionsUrl = resolveCompatCompletionsUrl(env)
    const model = request.model?.trim() || resolveHostedModel(env)
    const vendor = parseVendorPrefix(model)
    const apiKey = resolveApiKey(env, vendor)

    const maxTokens = clampCompletionMaxTokens(request.maxTokens, 256)
    const temperature = request.temperature ?? 0
    const disableThinking = request.disableThinking !== false
    const messages = resolveMessages(request)
    const body = buildChatBody(vendor, model, messages, maxTokens, temperature, disableThinking)

    const response = await fetch(completionsUrl, {
      method: 'POST',
      headers: buildAuthHeaders(env, apiKey),
      body
    })

    if (!response.ok) {
      const failPayload = (await response.json().catch(() => ({}))) as CompatChatResponse
      const failMessage =
        failPayload.error?.message || response.statusText || 'gateway_compat_request_failed'
      throw new Error(`gateway_compat_upstream_${vendor}:${failMessage}`)
    }

    const payload = (await response.json().catch(() => ({}))) as CompatChatResponse
    const choice = payload.choices?.[0]
    const message = choice?.message
    const text = message?.content?.trim() || message?.reasoning_content?.trim()
    if (!text) {
      const finishReason = choice?.finish_reason ?? 'unknown'
      throw new Error(`gateway_compat_empty_response:${vendor}:${finishReason}`)
    }

    const usage = payload.usage
    return {
      text,
      model,
      providerId: PROVIDER_ID,
      ...(usage?.total_tokens !== undefined ? { tokensUsed: usage.total_tokens } : {}),
      ...(usage?.prompt_tokens !== undefined ? { promptTokens: usage.prompt_tokens } : {}),
      ...(usage?.completion_tokens !== undefined
        ? { completionTokens: usage.completion_tokens }
        : {})
    }
  }
}
