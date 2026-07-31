/**
 * AI 相关类型定义
 */

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
