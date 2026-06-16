/**
 * AI 相关类型定义
 */

/**
 * AI 文本补全请求体
 */
export interface AICompleteRequest {
  /** 提示词 */
  prompt?: string

  /** 消息列表（Chat 模式） */
  messages?: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>

  /** 是否流式返回 */
  stream?: boolean

  /** 模型名称 */
  model?: string

  /** 采样温度 (0-1) */
  temperature?: number

  /** 最大返回 Token 数 */
  max_tokens?: number
}

/**
 * Pro 托管 LLM 补全请求体
 */
export interface AIHostedCompleteRequest {
  /** 提示词 */
  prompt?: string
  /** 最大返回 Token 数 */
  maxTokens?: number
  /** 采样温度 */
  temperature?: number
}
