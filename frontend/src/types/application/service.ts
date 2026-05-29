/**
 * 应用层通用服务工具类型。
 */
export interface ServiceStatus {
  /** 服务名称 */
  name: string
  /** 当前是否健康 */
  healthy: boolean
  /** 最后检测时间戳（毫秒） */
  lastCheckedAt: number
  /** 附加说明 */
  details?: string
}

/** 重试策略定义。 */
export interface RetryPolicy {
  /** 最大尝试次数 */
  maxAttempts: number
  /** 基础退避时间（毫秒） */
  backoffMs: number
  /** 抖动系数（毫秒） */
  jitter?: number
}

/**
 * 通用服务配置。
 */
export interface ServiceConfig {
  /** 接口基础地址 */
  baseUrl: string
  /** 默认超时时间（毫秒） */
  timeout: number
  /** 附加请求头 */
  headers?: Record<string, string>
  /** 可选的重试策略 */
  retry?: RetryPolicy
}

/**
 * 筛选 Worker 适配器的配置接口。
 */
export interface SearchWorkerAdapterOptions {
  /** 自定义 Worker URL，缺省为项目内置版本 */
  workerUrl?: string
  /** 内存缓存大小 */
  cacheSize?: number
  /** 请求返回的最大结果数 */
  limit?: number
  /** 启动时是否预热 Worker */
  warmup?: boolean
}
