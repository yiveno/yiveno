/**
 * LLM 基础设施层类型定义
 */

/**
 * LLM 提供者类型
 */
export type LLMProvider = 'hosted' | 'openai' | 'claude' | 'gemini' | 'deepseek'

/**
 * LLM 能力检测结果
 */
export interface LLMCapability {
  /** 是否可用 */
  available: boolean
  /** 提供者类型 */
  provider: LLMProvider
  /** 不可用时的原因 */
  reason?: string
  /** 功能特性 */
  features: {
    /** 是否支持文本补全 */
    textCompletion: boolean
    /** 是否支持向量嵌入 */
    embedding: boolean
    /** 最大 token 数 */
    maxTokens: number
    /** 是否支持流式输出 */
    streaming: boolean
  }
}

/**
 * LLM 任务类型
 */
export type LLMTaskType = 'categorize' | 'summarize' | 'embedding' | 'deep-analysis' | 'organize'

/**
 * LLM 任务复杂度
 */
export type LLMTaskComplexity = 'simple' | 'complex'

/**
 * LLM 任务描述
 */
export interface LLMTask {
  /** 任务类型 */
  type: LLMTaskType
  /** 任务复杂度 */
  complexity: LLMTaskComplexity
  /** 数据大小（字符数） */
  dataSize: number
}

/**
 * LLM 补全选项
 */
export interface LLMCompleteOptions {
  /** 最大 token 数 */
  maxTokens?: number
  /** 温度（0-1），控制随机性 */
  temperature?: number
  /** 是否流式输出 */
  streaming?: boolean
}

/**
 * LLM 补全结果
 */
export interface LLMCompleteResult {
  /** 生成的文本 */
  text: string
  /** 使用的提供者 */
  provider: LLMProvider
  /** token 使用量（如果可用） */
  tokensUsed?: number
}

/**
 * LLM 嵌入结果
 */
export interface LLMEmbeddingResult {
  /** 向量数组 */
  vector: number[]
  /** 使用的提供者 */
  provider: LLMProvider
  /** 维度 */
  dimensions: number
}
