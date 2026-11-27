/**
 * DeepSeek Chat Completions adapter（第一个 AiChatProvider 实现）。
 *
 * 默认经 Cloudflare AI Gateway 转发；未配置 Gateway 时直连 api.deepseek.com。
 * Gateway 若开启 Authenticated Gateway，需 Secret `AI_GATEWAY_TOKEN` → 头 `cf-aig-authorization`。
 * 经 Gateway 时发 `cf-aig-collect-log-payload: false`，关闭 prompt/response 正文落盘（元数据日志仍保留）。
 * 经 Gateway 时发 `cf-aig-skip-cache: true`（缓存键不含用户身份且命中仍扣配额，收益近零故关闭）。
 * 上游失败抛 AiProviderError（结构化 kind / status / vendorCode）；保留 2009 与 Gateway 401 归因文案。
 */

import {
  DEEPSEEK_DEFAULT_BASE_URL,
  resolveDeepSeekChatCompletionsUrl,
  isDeepSeekAiGatewayEnabled,
  resolveHostedModel,
  clampCompletionMaxTokens
} from '../../config/ai-hosted'
import type { Env } from '../../types/env'
import { warn as logWarn } from '../../utils/logger'
import type {
  AiChatCompleteRequest,
  AiChatCompleteResult,
  AiChatMessage,
  AiChatProvider
} from './ai-chat-provider'
import {
  AiProviderError,
  classifyAiProviderError,
  classifyFetchFailure,
  normalizeVendorCode,
  parseRetryAfterMs,
  pickRateLimitHeaders,
  sanitizeAiProviderDetails
} from './ai-provider-error'

const PROVIDER_ID = 'deepseek'

/** Gateway / DeepSeek 错误体；code 2009 = provider 拒 key（可能是 number 或 string） */
interface DeepSeekChatResponse {
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
    code?: number | string
    type?: string
    details?: unknown
  }
}

/** 401 成因：2009 = provider 拒 key；否则按网关鉴权解释 */
type AuthFailCause = 'provider_key_rejected' | 'gateway_auth' | 'unknown'

function resolveAuthFailCause(errorCode: number | string | undefined): AuthFailCause {
  if (errorCode !== undefined && String(errorCode) === '2009') {
    return 'provider_key_rejected'
  }
  if (errorCode !== undefined) {
    return 'gateway_auth'
  }
  return 'unknown'
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
  // 只关 payload 正文日志；token/费用/延迟等元数据仍由 Gateway 采集
  if (viaGateway) {
    headers['cf-aig-collect-log-payload'] = 'false'
    headers['cf-aig-skip-cache'] = 'true'
  }
  return headers
}

function formatUpstreamError(
  viaGateway: boolean,
  status: number,
  message: string,
  hasGatewayToken: boolean,
  errorCode?: number | string
): string {
  if (status === 401 && String(errorCode) === '2009') {
    return (
      'deepseek_api_key_rejected: DeepSeek 拒绝了 API key（错误码 2009）。' +
      '请检查 DEEPSEEK_API_KEY 是否有效或账户是否欠费。'
    )
  }
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

async function readJsonPayload(
  response: Response
): Promise<{ ok: true; payload: DeepSeekChatResponse } | { ok: false; rawPreview: string }> {
  const raw = await response.text()
  try {
    return { ok: true, payload: JSON.parse(raw) as DeepSeekChatResponse }
  } catch {
    return { ok: false, rawPreview: raw.slice(0, 200) }
  }
}

function throwDeepSeekUpstreamFailure(args: {
  viaGateway: boolean
  path: 'gateway' | 'direct'
  model: string
  status: number
  statusText: string
  headers: Headers
  hasGatewayToken: boolean
  payload: DeepSeekChatResponse | null
  rawPreview?: string
  /** 直连回退失败时附加说明 */
  directFallbackSuffix?: string
}): never {
  const err = args.payload?.error
  const failMessage = err?.message || args.statusText || 'deepseek_request_failed'
  const vendorCode = normalizeVendorCode(err?.code)
  const causeCore = formatUpstreamError(
    args.viaGateway,
    args.status,
    failMessage,
    args.hasGatewayToken,
    err?.code
  )
  const causeMessage = args.directFallbackSuffix
    ? `${causeCore}${args.directFallbackSuffix}`
    : causeCore

  const detailsSource = {
    path: args.path,
    ...(err?.type !== undefined ? { type: err.type } : {}),
    ...(err?.details !== undefined ? { vendorDetails: err.details } : {}),
    ...(args.rawPreview ? { rawPreview: args.rawPreview } : {}),
    ...(args.directFallbackSuffix ? { directFallback: true } : {})
  }
  const details = sanitizeAiProviderDetails(detailsSource)
  const rateLimitHeaders = pickRateLimitHeaders(args.headers)
  const retryAfterMs = parseRetryAfterMs(args.headers, err?.details)
  const classifyDetails = err?.details ?? detailsSource
  const kind = classifyAiProviderError({
    status: args.status,
    message: causeMessage,
    headers: args.headers,
    ...(vendorCode !== undefined ? { vendorCode } : {}),
    ...(classifyDetails !== undefined ? { details: classifyDetails } : {})
  })

  throw new AiProviderError({
    kind,
    providerId: PROVIDER_ID,
    vendor: 'deepseek',
    model: args.model,
    status: args.status,
    causeMessage,
    ...(vendorCode !== undefined ? { vendorCode } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    ...(rateLimitHeaders !== undefined ? { rateLimitHeaders } : {}),
    ...(details !== undefined ? { details } : {})
  })
}

export const deepseekAiChatProvider: AiChatProvider = {
  id: PROVIDER_ID,

  isConfigured(env: Env): boolean {
    return Boolean(env.DEEPSEEK_API_KEY?.trim())
  },

  async complete(env: Env, request: AiChatCompleteRequest): Promise<AiChatCompleteResult> {
    const apiKey = env.DEEPSEEK_API_KEY?.trim()
    if (!apiKey) {
      throw new AiProviderError({
        kind: 'misconfigured',
        providerId: PROVIDER_ID,
        vendor: 'deepseek',
        causeMessage: 'DEEPSEEK_API_KEY 未配置'
      })
    }

    const viaGateway = isDeepSeekAiGatewayEnabled(env)
    const completionsUrl = resolveDeepSeekChatCompletionsUrl(env)
    const model = request.model?.trim() || resolveHostedModel(env)
    const maxTokens = clampCompletionMaxTokens(request.maxTokens, 256)
    const temperature = request.temperature ?? 0.6
    const disableThinking = request.disableThinking !== false
    const hasGatewayToken = Boolean(env.AI_GATEWAY_TOKEN?.trim())
    const messages = resolveMessages(request)
    const body = buildChatBody(model, messages, maxTokens, temperature, disableThinking)

    let response: Response
    try {
      response = await fetch(completionsUrl, {
        method: 'POST',
        headers: buildAuthHeaders(env, apiKey, viaGateway),
        body
      })
    } catch (err) {
      const kind = classifyFetchFailure(err)
      const causeMessage =
        err instanceof Error ? err.message : `deepseek_fetch_failed:${String(err)}`
      throw new AiProviderError({
        kind,
        providerId: PROVIDER_ID,
        vendor: 'deepseek',
        model,
        causeMessage
      })
    }

    // Gateway 鉴权开了但未配 CF token：回退直连，避免本地线索理解整段挂死
    if (viaGateway && response.status === 401 && !hasGatewayToken) {
      const gatewayParsed = await readJsonPayload(response)
      const gatewayFailPayload = gatewayParsed.ok ? gatewayParsed.payload : {}
      const gatewayErrorCode = gatewayFailPayload.error?.code
      const authFailCause = resolveAuthFailCause(gatewayErrorCode)
      logWarn('deepseek_gateway_401_fallback_direct', {
        status: 401,
        errorCode: gatewayErrorCode ?? null,
        authFailCause,
        path: 'direct_retry',
        model
      })

      const directUrl = `${DEEPSEEK_DEFAULT_BASE_URL}/v1/chat/completions`
      try {
        response = await fetch(directUrl, {
          method: 'POST',
          headers: buildAuthHeaders(env, apiKey, false),
          body
        })
      } catch (err) {
        const kind = classifyFetchFailure(err)
        const causeMessage =
          err instanceof Error ? err.message : `deepseek_fetch_failed:${String(err)}`
        throw new AiProviderError({
          kind,
          providerId: PROVIDER_ID,
          vendor: 'deepseek',
          model,
          causeMessage: `${causeMessage}；直连回退亦失败: ${causeMessage}`,
          details: sanitizeAiProviderDetails({ path: 'direct', directFallback: true })
        })
      }

      if (!response.ok) {
        const parsed = await readJsonPayload(response)
        if (parsed.ok) {
          const failMessage =
            parsed.payload.error?.message || response.statusText || 'deepseek_request_failed'
          throwDeepSeekUpstreamFailure({
            viaGateway: false,
            path: 'direct',
            model,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            hasGatewayToken: false,
            payload: parsed.payload,
            directFallbackSuffix: `；直连回退亦失败: ${failMessage}`
          })
        }
        throwDeepSeekUpstreamFailure({
          viaGateway: false,
          path: 'direct',
          model,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          hasGatewayToken: false,
          payload: null,
          rawPreview: parsed.rawPreview,
          directFallbackSuffix: `；直连回退亦失败: ${response.statusText || 'deepseek_request_failed'}`
        })
      }
      logWarn('deepseek_gateway_401_fallback_direct_ok', {
        path: 'direct',
        model
      })
    } else if (!response.ok) {
      const parsed = await readJsonPayload(response)
      if (parsed.ok) {
        throwDeepSeekUpstreamFailure({
          viaGateway,
          path: viaGateway ? 'gateway' : 'direct',
          model,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          hasGatewayToken,
          payload: parsed.payload
        })
      }
      throwDeepSeekUpstreamFailure({
        viaGateway,
        path: viaGateway ? 'gateway' : 'direct',
        model,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        hasGatewayToken,
        payload: null,
        rawPreview: parsed.rawPreview
      })
    }

    const parsed = await readJsonPayload(response)
    if (!parsed.ok) {
      throw new AiProviderError({
        kind: 'invalid_response',
        providerId: PROVIDER_ID,
        vendor: 'deepseek',
        model,
        status: response.status,
        causeMessage: 'deepseek_invalid_response:json_parse_failed',
        details: sanitizeAiProviderDetails({ rawPreview: parsed.rawPreview })
      })
    }

    const payload = parsed.payload
    const choice = payload.choices?.[0]
    const message = choice?.message
    const text = message?.content?.trim() || message?.reasoning_content?.trim()
    if (!text) {
      const finishReason = choice?.finish_reason ?? 'unknown'
      throw new AiProviderError({
        kind: 'empty_response',
        providerId: PROVIDER_ID,
        vendor: 'deepseek',
        model,
        status: response.status,
        causeMessage: `deepseek_empty_response:${finishReason}`,
        details: sanitizeAiProviderDetails({ finishReason })
      })
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
): Promise<{
  text: string
  model: string
  tokensUsed?: number
  promptTokens?: number
  completionTokens?: number
}> {
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
    ...(result.tokensUsed !== undefined ? { tokensUsed: result.tokensUsed } : {}),
    ...(result.promptTokens !== undefined ? { promptTokens: result.promptTokens } : {}),
    ...(result.completionTokens !== undefined ? { completionTokens: result.completionTokens } : {})
  }
}
