/**
 * Eval 专用：OpenAI 兼容 Chat Completions（DeepSeek / OpenAI / DashScope / Perplexity Orchestrator 等）。
 * 禁止接入产品主路径或数据平面。
 * 开发直连线索理解亦复用本函数，须与 hosted/clue 同 12s 预算。
 */

import { CLUE_LLM_COMPLETE_TIMEOUT_MS } from '@/core/recall/understand/clue-llm-timeout'
import { parseLlmChatUsage, type LlmChatUsage } from '@/core/recall/understand/llm-chat-usage'

export interface OpenAiCompatibleChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 离线 / 直连 profile：决定请求体字段与 completions path 拼接。 */
/**
 * OpenAI 兼容厂商配置档（补全 URL / 请求体差异）。
 * - deepseek：DeepSeek 官方兼容
 * - openai：OpenAI 官方
 * - dashscope：阿里云百炼兼容模式
 * - perplexity：Perplexity Orchestrator（标准 Chat Completions；无 thinking / reasoning_effort）
 */
export type OpenAiCompatibleChatCompat =
  | 'deepseek' // DeepSeek
  | 'openai' // OpenAI
  | 'dashscope' // 百炼 DashScope
  | 'perplexity' // Perplexity Orchestrator

export interface OpenAiCompatibleChatConfig {
  /** API Key */
  apiKey: string
  /** API 基址（如 https://api.deepseek.com） */
  baseUrl: string
  /** 模型 id */
  model: string
  temperature?: number
  maxTokens?: number
  compat?: OpenAiCompatibleChatCompat
  /** DeepSeek V4：默认关闭 thinking，避免 content 为空；dashscope 初筛 omit 思考字段 */
  disableThinking?: boolean
}

interface ChatCompletionsResponse {
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
  error?: { message?: string }
}

/** API 返回的 token 用量；字段缺失则为 null（记 MISSING，禁止推算）。 */
export type OpenAiCompatibleChatUsage = LlmChatUsage

/** 带墙钟与 usage 的补全结果（eval / 离线对比用）。 */
export interface OpenAiCompatibleChatDetailedResult {
  text: string
  /** completer 墙钟（含网络），毫秒 */
  latencyMs: number
  /** 响应无 usage 时各字段为 null */
  usage: OpenAiCompatibleChatUsage
}

/**
 * 拼 chat/completions URL，避免 base 已含 `/v1` 或 `/compatible-mode/v1` 时双拼。
 * 例：`…/compatible-mode/v1` → `…/compatible-mode/v1/chat/completions`
 */
export function resolveOpenAiCompatibleChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '')
  if (/\/compatible-mode\/v1$/i.test(trimmed) || /\/v1$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }
  return `${trimmed}/v1/chat/completions`
}

/**
 * 调用 chat/completions，返回文本 + latency + usage。
 * 供 parse-gold 离线对比；产品主路径仍可用薄包装 `completeOpenAiCompatibleChat`。
 */
export async function completeOpenAiCompatibleChatDetailed(
  config: OpenAiCompatibleChatConfig,
  messages: OpenAiCompatibleChatMessage[]
): Promise<OpenAiCompatibleChatDetailedResult> {
  const temperature = config.temperature ?? 0
  const maxTokens = config.maxTokens ?? 400
  const disableThinking = config.disableThinking !== false
  const compat = config.compat ?? 'deepseek'
  const url = resolveOpenAiCompatibleChatCompletionsUrl(config.baseUrl)

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature
  }
  // 各厂商 profile：禁止混发他厂思考字段
  if (compat === 'openai') {
    body.max_completion_tokens = maxTokens
    body.reasoning_effort = 'none'
  } else if (compat === 'dashscope' || compat === 'perplexity') {
    // 百炼 / Orchestrator：标准 max_tokens；omit thinking / reasoning_effort / enable_thinking
    body.max_tokens = maxTokens
  } else {
    body.max_tokens = maxTokens
    body.thinking = { type: disableThinking ? 'disabled' : 'enabled' }
  }

  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(CLUE_LLM_COMPLETE_TIMEOUT_MS)
  })

  const payload = (await response.json().catch(() => ({}))) as ChatCompletionsResponse
  const latencyMs = Date.now() - startedAt
  if (!response.ok) {
    const rawMessage = payload.error?.message || response.statusText || 'chat_completions_failed'
    const message = rawMessage
      .replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')
      .replace(/api key:\s*\S+/gi, 'api key: ***')
    throw new Error(message)
  }

  const message = payload.choices?.[0]?.message
  const text = message?.content?.trim() || message?.reasoning_content?.trim()
  if (!text) {
    throw new Error(`chat_empty_response:${payload.choices?.[0]?.finish_reason ?? 'unknown'}`)
  }
  return {
    text,
    latencyMs,
    usage: parseLlmChatUsage(payload.usage)
  }
}

/** 调用 chat/completions，返回助手文本。 */
export async function completeOpenAiCompatibleChat(
  config: OpenAiCompatibleChatConfig,
  messages: OpenAiCompatibleChatMessage[]
): Promise<string> {
  const detailed = await completeOpenAiCompatibleChatDetailed(config, messages)
  return detailed.text
}
