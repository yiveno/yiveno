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
 * 上游失败抛 AiProviderError（结构化 kind / status / vendorCode / retryAfterMs）。
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
import {
  AiProviderError,
  classifyAiProviderError,
  classifyFetchFailure,
  normalizeVendorCode,
  parseRetryAfterMs,
  pickRateLimitHeaders,
  sanitizeAiProviderDetails
} from './ai-provider-error'

const PROVIDER_ID = 'gateway-compat'

/** compat 端点支持的厂商前缀 → 对应 Secret 键名 */
type CompatVendor = 'deepseek' | 'openai' | 'google-ai-studio' | 'groq'

const VENDOR_API_KEY_ENV: Record<CompatVendor, keyof Env> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  'google-ai-studio': 'GOOGLE_AI_API_KEY',
  groq: 'GROQ_API_KEY'
}

/** OpenAI / Google 兼容错误体；details 可能是数组或对象。 */
interface CompatUpstreamErrorBody {
  message?: string
  code?: string | number
  status?: string | number
  type?: string
  details?: unknown
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
  error?: CompatUpstreamErrorBody | CompatUpstreamErrorBody[]
  /** AI Gateway 自身校验错误时可能出现 */
  message?: string
  httpCode?: number
  internalCode?: number | string
}

function resolveMessages(request: AiChatCompleteRequest): AiChatMessage[] {
  if (request.messages && request.messages.length > 0) {
    return request.messages
  }
  const prompt = request.prompt?.trim() ?? ''
  return [{ role: 'user', content: prompt || ' ' }]
}

function throwMisconfigured(causeMessage: string, model?: string): never {
  throw new AiProviderError({
    kind: 'misconfigured',
    providerId: PROVIDER_ID,
    causeMessage,
    ...(model !== undefined ? { model } : {})
  })
}

function parseVendorPrefix(model: string): CompatVendor {
  const slash = model.indexOf('/')
  if (slash <= 0) {
    throwMisconfigured(
      `gateway_compat_model_missing_provider_prefix: 模型名须含厂商前缀（如 deepseek/deepseek-flash），收到「${model}」`,
      model
    )
  }
  const prefix = model.slice(0, slash)
  if (
    prefix === 'deepseek' ||
    prefix === 'openai' ||
    prefix === 'google-ai-studio' ||
    prefix === 'groq'
  ) {
    return prefix
  }
  throwMisconfigured(
    `gateway_compat_unsupported_provider_prefix: 不支持前缀「${prefix}」（支持 deepseek / openai / google-ai-studio / groq）`,
    model
  )
}

function resolveCompatCompletionsUrl(env: Env): string {
  const accountId = env.AI_GATEWAY_ACCOUNT_ID?.trim()
  const gatewayId = env.AI_GATEWAY_ID?.trim()
  if (!accountId || !gatewayId) {
    throwMisconfigured(
      'gateway_compat_misconfigured: 需要 AI_GATEWAY_ACCOUNT_ID 与 AI_GATEWAY_ID，缺任一时不可调用（不直连、不回退 DeepSeek）'
    )
  }
  return `${AI_GATEWAY_DEFAULT_HOST}/v1/${accountId}/${gatewayId}/compat/chat/completions`
}

function resolveApiKey(env: Env, vendor: CompatVendor): string {
  const envKey = VENDOR_API_KEY_ENV[vendor]
  const apiKey = (env[envKey] as string | undefined)?.trim()
  if (!apiKey) {
    throwMisconfigured(`gateway_compat_api_key_missing: 厂商 ${vendor} 需要配置 ${String(envKey)}`)
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

  // google-ai-studio / groq：不发 thinking / reasoning 字段
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

/**
 * 归一化 compat 错误 JSON：
 * - OpenAI / Groq：`{ error: { message, code, type } }`
 * - Google（实测）：`[{ error: { code, message, status } }]` 数组包装
 * - Gateway 自身：`{ error: [...], message, internalCode, httpCode }`
 */
function normalizeCompatPayload(raw: unknown): CompatChatResponse {
  if (Array.isArray(raw)) {
    const first = raw[0]
    if (first && typeof first === 'object') {
      return first as CompatChatResponse
    }
    return {}
  }
  if (raw && typeof raw === 'object') {
    return raw as CompatChatResponse
  }
  return {}
}

/** 从兼容错误体抽出 message / code / details（OpenAI 与 Google 形状）。 */
function extractUpstreamError(payload: CompatChatResponse): {
  message?: string
  code?: string | number
  details?: unknown
} {
  const rawErr = payload.error
  const err: CompatUpstreamErrorBody | undefined = Array.isArray(rawErr)
    ? rawErr[0]
    : rawErr && typeof rawErr === 'object'
      ? rawErr
      : undefined

  if (!err) {
    // Gateway 顶层 message / internalCode（无嵌套 error 对象时）
    if (payload.message || payload.internalCode !== undefined) {
      return {
        ...(payload.message !== undefined ? { message: payload.message } : {}),
        ...(payload.internalCode !== undefined ? { code: payload.internalCode } : {}),
        details: {
          ...(payload.httpCode !== undefined ? { httpCode: payload.httpCode } : {}),
          gatewayShape: true
        }
      }
    }
    return {}
  }

  const details =
    err.details !== undefined
      ? err.details
      : {
          ...(err.status !== undefined ? { status: err.status } : {}),
          ...(err.type !== undefined ? { type: err.type } : {})
        }
  return {
    ...(err.message !== undefined ? { message: err.message } : {}),
    ...(err.code !== undefined ? { code: err.code } : {}),
    ...(Object.keys(details as object).length > 0 ? { details } : {})
  }
}

async function readJsonPayload(
  response: Response
): Promise<{ ok: true; payload: CompatChatResponse } | { ok: false; rawPreview: string }> {
  const raw = await response.text()
  try {
    return { ok: true, payload: normalizeCompatPayload(JSON.parse(raw)) }
  } catch {
    return { ok: false, rawPreview: raw.slice(0, 200) }
  }
}

function throwUpstreamFailure(args: {
  vendor: CompatVendor
  model: string
  status: number
  statusText: string
  headers: Headers
  payload: CompatChatResponse | null
  rawPreview?: string
}): never {
  const extracted = args.payload ? extractUpstreamError(args.payload) : {}
  const failMessage = extracted.message || args.statusText || 'gateway_compat_request_failed'
  const vendorCode = normalizeVendorCode(extracted.code)
  const details = sanitizeAiProviderDetails(
    extracted.details ?? (args.rawPreview ? { rawPreview: args.rawPreview } : undefined)
  )
  const rateLimitHeaders = pickRateLimitHeaders(args.headers)
  const retryAfterMs = parseRetryAfterMs(args.headers, extracted.details)
  const kind = classifyAiProviderError({
    status: args.status,
    message: failMessage,
    headers: args.headers,
    ...(vendorCode !== undefined ? { vendorCode } : {}),
    ...(extracted.details !== undefined ? { details: extracted.details } : {})
  })

  throw new AiProviderError({
    kind,
    providerId: PROVIDER_ID,
    vendor: args.vendor,
    model: args.model,
    status: args.status,
    causeMessage: `gateway_compat_upstream_${args.vendor}:${failMessage}`,
    ...(vendorCode !== undefined ? { vendorCode } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    ...(rateLimitHeaders !== undefined ? { rateLimitHeaders } : {}),
    ...(details !== undefined ? { details } : {})
  })
}

export const gatewayCompatAiChatProvider: AiChatProvider = {
  id: PROVIDER_ID,

  isConfigured(env: Env): boolean {
    const hasGateway = Boolean(env.AI_GATEWAY_ACCOUNT_ID?.trim() && env.AI_GATEWAY_ID?.trim())
    if (!hasGateway) return false
    return Boolean(
      env.DEEPSEEK_API_KEY?.trim() ||
      env.OPENAI_API_KEY?.trim() ||
      env.GOOGLE_AI_API_KEY?.trim() ||
      env.GROQ_API_KEY?.trim()
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

    let response: Response
    try {
      response = await fetch(completionsUrl, {
        method: 'POST',
        headers: buildAuthHeaders(env, apiKey),
        body
      })
    } catch (err) {
      const kind = classifyFetchFailure(err)
      const causeMessage =
        err instanceof Error ? err.message : `gateway_compat_fetch_failed:${String(err)}`
      throw new AiProviderError({
        kind,
        providerId: PROVIDER_ID,
        vendor,
        model,
        causeMessage: `gateway_compat_upstream_${vendor}:${causeMessage}`
      })
    }

    if (!response.ok) {
      const parsed = await readJsonPayload(response)
      if (parsed.ok) {
        throwUpstreamFailure({
          vendor,
          model,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          payload: parsed.payload
        })
      }
      throwUpstreamFailure({
        vendor,
        model,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        payload: null,
        rawPreview: parsed.rawPreview
      })
    }

    const parsed = await readJsonPayload(response)
    if (!parsed.ok) {
      throw new AiProviderError({
        kind: 'invalid_response',
        providerId: PROVIDER_ID,
        vendor,
        model,
        status: response.status,
        causeMessage: `gateway_compat_invalid_response:${vendor}:json_parse_failed`,
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
        vendor,
        model,
        status: response.status,
        causeMessage: `gateway_compat_empty_response:${vendor}:${finishReason}`,
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
