/**
 * LLM 基础设施层类型定义
 */

/**
 * LLM 提供者类型
 */
export type LLMProvider = 'builtin' | 'openai' | 'claude' | 'gemini'

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

/**
 * Chrome 内置 LLM API 类型（如果可用）
 */
export interface BuiltInLLMAPI {
  /**
   * 检查是否可以创建文本会话
   * @returns 'readily' | 'no-model' | 'no-session' | 'no'
   */
  canCreateTextSession(): Promise<'readily' | 'no-model' | 'no-session' | 'no'>
  /**
   * 创建文本会话
   */
  createTextSession(): Promise<BuiltInTextSession>
  /**
   * Summarizer API（Chrome 138+）
   */
  summarizer?: BuiltInSummarizerAPI
}

/**
 * Chrome 内置 LLM 文本会话
 */
export interface BuiltInTextSession {
  /**
   * 发送提示并获取完整结果
   */
  prompt(prompt: string): Promise<string>
  /**
   * 发送提示并获取流式结果
   */
  promptStreaming(prompt: string): AsyncIterable<string>
}

/**
 * Chrome 内置 Summarizer API（Chrome 138+）
 */
export interface BuiltInSummarizerAPI {
  /**
   * 检查 Summarizer 能力
   */
  capabilities(): Promise<SummarizerCapabilities>
  /**
   * 创建 Summarizer 实例
   */
  create(options?: SummarizerOptions): Promise<BuiltInSummarizer>
}

/**
 * Summarizer 能力检测结果
 */
export interface SummarizerCapabilities {
  /** 是否可用 */
  available: 'readily' | 'after-download' | 'no'
  /** 默认类型 */
  defaultType?: SummarizerType
  /** 默认格式 */
  defaultFormat?: SummarizerFormat
  /** 默认长度 */
  defaultLength?: SummarizerLength
}

/**
 * Summarizer 配置选项
 */
export interface SummarizerOptions {
  /** 摘要类型 */
  type?: SummarizerType
  /** 输出格式 */
  format?: SummarizerFormat
  /** 摘要长度 */
  length?: SummarizerLength
  /** 上下文（可选） */
  context?: string
}

/**
 * Summarizer 类型
 */
export type SummarizerType =
  | 'tl;dr' // 简短摘要（默认）
  | 'key-points' // 关键点提取
  | 'teaser' // 预览式摘要
  | 'headline' // 标题式摘要

/**
 * Summarizer 输出格式
 */
export type SummarizerFormat =
  | 'plain-text' // 纯文本（默认）
  | 'markdown' // Markdown 格式

/**
 * Summarizer 长度
 */
export type SummarizerLength =
  | 'short' // 短（默认）
  | 'medium' // 中
  | 'long' // 长

/**
 * Chrome 内置 Summarizer 实例
 */
export interface BuiltInSummarizer {
  /**
   * 生成摘要
   */
  summarize(text: string): Promise<string>
  /**
   * 流式生成摘要
   */
  summarizeStreaming(text: string): AsyncIterable<string>
  /**
   * 销毁实例
   */
  destroy(): void
}

/**
 * 全局 Window 对象扩展（包含 Chrome 内置 LLM）
 */
declare global {
  interface Window {
    ai?: BuiltInLLMAPI
  }
}
