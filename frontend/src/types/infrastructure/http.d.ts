/**
 * HTTP 基础设施类型定义
 *
 * 包含 HTTP 请求相关的所有类型定义
 */

/**
 * HTTP 方法类型
 *
 * 支持的 HTTP 请求方法
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

/**
 * HTTP 请求配置接口
 *
 * 发送 HTTP 请求的配置选项
 */
export interface HttpRequestConfig {
  /** 请求URL */
  url: string

  /** 请求方法 */
  method?: HttpMethod

  /** 请求头 */
  headers?: Record<string, string>

  /** 请求参数（查询字符串） */
  params?: Record<string, string | number | boolean>

  /** 请求体 */
  body?: unknown

  /** 超时时间（毫秒） */
  timeout?: number

  /** 是否携带凭证 */
  credentials?: RequestCredentials

  /** 缓存策略 */
  cache?: RequestCache

  /** 重定向策略 */
  redirect?: RequestRedirect

  /** 引用策略 */
  referrer?: string

  /** 信号控制器 */
  signal?: AbortSignal

  /** 响应类型 */
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'formdata'

  /** 重试配置 */
  retry?: RetryConfig

  /** 是否自动添加认证头 */
  auth?: boolean
}

/**
 * HTTP 响应接口
 *
 * HTTP 响应的数据结构
 */
export interface HttpResponse<T = unknown> {
  /** 响应数据 */
  data: T

  /** HTTP 状态码 */
  status: number

  /** 状态文本 */
  statusText: string

  /** 响应头 */
  headers: Record<string, string>

  /** 请求配置 */
  config: HttpRequestConfig

  /** 是否成功 (2xx) */
  ok: boolean
}

/**
 * HTTP 错误接口
 *
 * HTTP 请求错误的数据结构
 */
export interface HttpError {
  /** 错误消息 */
  message: string

  /** HTTP 状态码 */
  status?: number

  /** 状态文本 */
  statusText?: string

  /** 响应数据 */
  data?: unknown

  /** 请求配置 */
  config?: HttpRequestConfig

  /** 原始错误 */
  originalError?: Error

  /** 是否网络错误 */
  isNetworkError?: boolean

  /** 是否超时 */
  isTimeout?: boolean

  /** 是否取消 */
  isCanceled?: boolean
}

/**
 * 重试配置接口
 *
 * HTTP 请求重试策略配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number

  /** 重试延迟（毫秒） */
  retryDelay: number

  /** 是否使用指数退避 */
  exponentialBackoff?: boolean

  /** 退避因子 */
  backoffFactor?: number

  /** 可重试的状态码 */
  retryableStatusCodes?: number[]

  /** 重试条件函数 */
  shouldRetry?: (error: HttpError) => boolean

  /** 重试回调 */
  onRetry?: (attempt: number, error: HttpError) => void
}

/**
 * API 客户端配置接口
 *
 * API 客户端的全局配置
 */
export interface ApiClientConfig {
  /** 基础URL */
  baseURL: string

  /** 默认超时时间 */
  timeout: number

  /** 默认请求头 */
  headers?: Record<string, string>

  /** 请求拦截器 */
  requestInterceptor?: RequestInterceptor

  /** 响应拦截器 */
  responseInterceptor?: ResponseInterceptor

  /** 错误拦截器 */
  errorInterceptor?: ErrorInterceptor

  /** 重试配置 */
  retry?: RetryConfig

  /** 是否自动添加认证头 */
  auth?: boolean

  /** 认证令牌获取函数 */
  getAuthToken?: () => string | Promise<string>
}

/**
 * 请求拦截器类型
 *
 * 在请求发送前拦截和修改
 */
export type RequestInterceptor = (
  config: HttpRequestConfig
) => HttpRequestConfig | Promise<HttpRequestConfig>

/**
 * 响应拦截器类型
 *
 * 在响应返回前拦截和修改
 */
export type ResponseInterceptor = <T>(
  response: HttpResponse<T>
) => HttpResponse<T> | Promise<HttpResponse<T>>

/**
 * 错误拦截器类型
 *
 * 在错误发生时拦截和处理
 */
export type ErrorInterceptor = (error: HttpError) => Promise<unknown> | never

/**
 * API 端点接口
 *
 * 定义单个 API 端点
 */
export interface ApiEndpoint {
  /** 端点路径 */
  path: string

  /** HTTP 方法 */
  method: HttpMethod

  /** 端点描述 */
  description?: string

  /** 请求参数定义 */
  params?: Record<string, unknown>

  /** 请求体定义 */
  body?: Record<string, unknown>

  /** 响应数据定义 */
  response?: Record<string, unknown>
}

/**
 * 请求队列配置接口
 *
 * 请求队列管理配置
 */
export interface RequestQueueConfig {
  /** 最大并发请求数 */
  maxConcurrent: number

  /** 是否启用队列 */
  enabled: boolean

  /** 队列策略 */
  strategy: 'fifo' | 'lifo' | 'priority'

  /** 超时时间（毫秒） */
  timeout: number
}

/**
 * 下载配置接口
 *
 * 文件下载的配置选项
 */
export interface DownloadConfig {
  /** 文件名 */
  filename: string

  /** 文件类型 */
  mimeType?: string

  /** 下载URL */
  url?: string

  /** 文件数据 */
  data?: Blob | ArrayBuffer

  /** 进度回调 */
  onProgress?: (progress: number) => void

  /** 是否自动触发下载 */
  autoDownload?: boolean
}

/**
 * 上传配置接口
 *
 * 文件上传的配置选项
 */
export interface UploadConfig {
  /** 上传URL */
  url: string

  /** 文件字段名 */
  fieldName: string

  /** 文件对象 */
  file: File | Blob

  /** 额外的表单数据 */
  formData?: Record<string, string>

  /** 请求头 */
  headers?: Record<string, string>

  /** 进度回调 */
  onProgress?: (progress: number) => void

  /** 是否分片上传 */
  chunked?: boolean

  /** 分片大小（字节） */
  chunkSize?: number
}

/**
 * 请求缓存配置接口
 *
 * HTTP 请求缓存配置
 */
export interface RequestCacheConfig {
  /** 是否启用缓存 */
  enabled: boolean

  /** 缓存时长（毫秒） */
  ttl: number

  /** 缓存键生成函数 */
  keyGenerator?: (config: HttpRequestConfig) => string

  /** 缓存存储 */
  storage?: 'memory' | 'indexeddb' | 'localstorage'

  /** 最大缓存条目数 */
  maxEntries?: number
}
