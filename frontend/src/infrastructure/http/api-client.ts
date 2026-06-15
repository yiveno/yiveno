/**
 * HTTP API 客户端 - 基础设施层
 *
 * 职责：
 * - 封装 fetch API 并提供统一错误处理
 * - 处理网络层错误和HTTP状态错误
 * - 提供重试机制和超时控制
 * - 支持请求/响应拦截器
 */

import type { Result } from '../../core/common/result'
import { ok, err } from '../../core/common/result'

/**
 * API 客户端配置
 */
export interface ApiClientConfig {
  baseURL?: string
  timeout?: number
  retries?: number
  retryDelay?: number
  headers?: Record<string, string>
}

/**
 * 请求选项
 */
export interface RequestOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * API 响应
 */
export interface ApiResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Headers
}

/**
 * API 错误
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public response?: Response
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * HTTP API 客户端
 */
export class ApiClient {
  private config: Required<ApiClientConfig>

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: '',
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json'
      },
      ...config
    }
  }

  /**
   * 发起 HTTP 请求
   */
  async request<T = unknown>(
    url: string,
    options: RequestOptions = {}
  ): Promise<Result<ApiResponse<T>, ApiError>> {
    try {
      const fullUrl = this.buildUrl(url)
      const requestOptions = this.buildRequestOptions(options)

      const response = await this.executeRequest(fullUrl, requestOptions)
      const data = await this.parseResponse<T>(response)

      return ok({
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    } catch (error) {
      if (error instanceof ApiError) {
        return err(error)
      }
      return err(new ApiError(error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  /**
   * GET 请求
   */
  async get<T = unknown>(
    url: string,
    options: RequestOptions = {}
  ): Promise<Result<ApiResponse<T>, ApiError>> {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  /**
   * POST 请求
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<Result<ApiResponse<T>, ApiError>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      ...(data !== undefined ? { body: JSON.stringify(data) } : {})
    })
  }

  /**
   * PUT 请求
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<Result<ApiResponse<T>, ApiError>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      ...(data !== undefined ? { body: JSON.stringify(data) } : {})
    })
  }

  /**
   * DELETE 请求
   */
  async delete<T = unknown>(
    url: string,
    options: RequestOptions = {}
  ): Promise<Result<ApiResponse<T>, ApiError>> {
    return this.request<T>(url, { ...options, method: 'DELETE' })
  }

  /**
   * 构建完整URL
   */
  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    return `${this.config.baseURL}${url.startsWith('/') ? url : `/${url}`}`
  }

  /**
   * 构建请求选项
   */
  private buildRequestOptions(options: RequestOptions): RequestInit {
    const {
      timeout: _timeout = this.config.timeout,

      retries: _retries = this.config.retries,

      retryDelay: _retryDelay = this.config.retryDelay,
      ...fetchOptions
    } = options

    return {
      ...fetchOptions,
      headers: {
        ...this.config.headers,
        ...fetchOptions.headers
      }
    }
  }

  /**
   * 执行请求（带重试机制）
   */
  private async executeRequest(url: string, options: RequestOptions): Promise<Response> {
    const { retries = this.config.retries, retryDelay = this.config.retryDelay } = options
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          options.timeout || this.config.timeout
        )

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response.statusText,
            response
          )
        }

        return response
      } catch (error) {
        lastError = error as Error

        // 如果是最后一次尝试，直接抛出错误
        if (attempt === retries) {
          break
        }

        // 等待后重试
        await this.delay(retryDelay * Math.pow(2, attempt))
      }
    }

    throw lastError || new Error('Request failed')
  }

  /**
   * 解析响应
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      return response.json()
    }

    if (contentType?.includes('text/')) {
      return response.text() as unknown as T
    }

    return response.blob() as unknown as T
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 设置默认配置
   */
  setConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<ApiClientConfig> {
    return { ...this.config }
  }
}

/**
 * 默认 API 客户端实例
 */
export const apiClient = new ApiClient()

/**
 * 便捷的请求函数（保持向后兼容）
 */
export async function request<T = unknown>(
  url: string,
  options?: RequestOptions
): Promise<Result<ApiResponse<T>, ApiError>> {
  return apiClient.request<T>(url, options)
}
