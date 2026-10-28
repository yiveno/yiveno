/**
 * AI 相关类型定义
 */

/**
 * Pro 托管 LLM 补全请求体
 */
export interface AIHostedCompleteRequest {
  /** 提示词（无 messages 时使用） */
  prompt?: string
  /** 多轮消息（与 clue/complete 对齐；优先于 prompt） */
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** 最大返回 Token 数 */
  maxTokens?: number
  /** 采样温度 */
  temperature?: number
  /**
   * 任务种类（闭集；缺省按 nlu）。
   * 仅服务端用于观测与模型路由；客户端不得传 model 名。
   */
  taskKind?: string
}
