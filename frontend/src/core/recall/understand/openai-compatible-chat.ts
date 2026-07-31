/**
 * Eval 专用：OpenAI 兼容 Chat Completions（DeepSeek / OpenAI 等）。
 * 禁止接入产品主路径或数据平面。
 */

export interface OpenAiCompatibleChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAiCompatibleChatConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  maxTokens?: number
  /** DeepSeek V4：默认关闭 thinking，避免 content 为空 */
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
  error?: { message?: string }
}

/** 调用 /v1/chat/completions，返回助手文本。 */
export async function completeOpenAiCompatibleChat(
  config: OpenAiCompatibleChatConfig,
  messages: OpenAiCompatibleChatMessage[]
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const temperature = config.temperature ?? 0
  const maxTokens = config.maxTokens ?? 400
  const disableThinking = config.disableThinking !== false

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: maxTokens,
    temperature
  }
  // DeepSeek 等兼容字段；未知提供商通常忽略
  body.thinking = { type: disableThinking ? 'disabled' : 'enabled' }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  })

  const payload = (await response.json().catch(() => ({}))) as ChatCompletionsResponse
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
  return text
}
