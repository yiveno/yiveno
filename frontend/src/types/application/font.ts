/**
 * 字体服务所涉及的公共类型。
 */
export type FontSource = 'google' | 'local' | 'system'

/**
 * 单个字体的描述信息。
 */
export interface FontDescriptor {
  /** 字体名称（可含空格） */
  family: string
  /** 字体来源：Google CDN、本地、系统 */
  source: FontSource
  /** 可用字重列表 */
  weights: number[]
  /** 支持的语种子集 */
  subsets?: string[]
  /** 备用字体族 */
  fallback?: string
}

/**
 * 字体加载任务描述，用于追踪异步状态。
 */
export interface FontLoadTask {
  /** 任务唯一 ID */
  id: string
  /** 对应的字体描述 */
  descriptor: FontDescriptor
  /** 当前状态 */
  status: 'pending' | 'loading' | 'loaded' | 'failed'
  /** 开始时间（毫秒） */
  startedAt: number
  /** 结束时间（毫秒） */
  finishedAt?: number
  /** 失败信息 */
  error?: string
}

/**
 * 字体服务全局配置。
 */
export interface FontServiceConfig {
  /** 是否自动检测语言 */
  enableAutoDetection: boolean
  /** 是否支持动态应用字体（MutationObserver） */
  enableDynamicApplication: boolean
  /** 调试模式：输出额外日志 */
  debugMode: boolean
  /** 需要应用系统 UI 字体的选择器 */
  systemUISelectors: string[]
  /** 用户内容区域使用的选择器 */
  userContentSelectors: string[]
}

/**
 * 语言检测结果类型。
 */
export type DetectedLanguage =
  | 'zh'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'en'
  | 'mixed'
  | 'unknown'

/**
 * 针对某种语言的字体策略。
 */
export interface FontStrategy {
  /** 检测到的语言 */
  detected: DetectedLanguage
  /** 系统 UI 场景下的字体栈 */
  systemUI: string
  /** 用户内容区域的字体栈 */
  userContent: string
}
