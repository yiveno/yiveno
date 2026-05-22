/**
 * 安全请求工具 - 基础设施层
 *
 * 职责：
 * - 提供安全的JSON请求功能
 * - 统一错误处理，避免异常冒泡
 * - 支持多种调用方式
 * - 与CSP兼容
 */

import { apiClient } from './api-client'

/**
 * 安全JSON请求选项
 */
export interface SafeFetchOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * 安全JSON请求结果
 */
export interface SafeFetchResult<T = unknown> {
  data: T | null
  success: boolean
  error?: string
  status?: number
}

/**
 * 安全JSON请求函数
 * 支持多种调用方式：
 * - safeJsonFetch(url)
 * - safeJsonFetch(url, timeout)
 * - safeJsonFetch(url, options)
 * - safeJsonFetch(url, timeout, options)
 */
export async function safeJsonFetch<T = unknown>(
  url: string,
  a?: number | SafeFetchOptions,
  b?: SafeFetchOptions
): Promise<T | null> {
  try {
    let options: SafeFetchOptions | undefined

    if (typeof a === 'number') {
      // safeJsonFetch(url, timeout, options)
      options = { ...b, timeout: a }
    } else {
      // safeJsonFetch(url, options)
      options = a
    }

    const result = await apiClient.request<T>(url, options)

    if (result.ok) {
      return result.value.data
    } else {
      return null
    }
  } catch {
    return null
  }
}

/**
 * 带详细结果的安全JSON请求
 */
export async function safeJsonFetchWithResult<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  try {
    const result = await apiClient.request<T>(url, options)

    if (result.ok) {
      return {
        data: result.value.data,
        success: true,
        status: result.value.status
      }
    } else {
      return {
        data: null,
        success: false,
        error: result.error.message,
        ...(result.error.status !== undefined ? { status: result.error.status } : {})
      }
    }
  } catch (error) {
    return {
      data: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 安全文本请求
 */
export async function safeTextFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<string | null> {
  try {
    const result = await apiClient.request<string>(url, {
      ...options,
      headers: {
        Accept: 'text/plain',
        ...options.headers
      }
    })

    if (result.ok) {
      return result.value.data
    } else {
      return null
    }
  } catch {
    return null
  }
}

/**
 * 安全二进制请求
 */
export async function safeBlobFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<Blob | null> {
  try {
    const result = await apiClient.request<Blob>(url, {
      ...options,
      headers: {
        Accept: 'application/octet-stream',
        ...options.headers
      }
    })

    if (result.ok) {
      return result.value.data
    } else {
      return null
    }
  } catch {
    return null
  }
}

/**
 * 安全POST请求
 */
export async function safePost<T = unknown>(
  url: string,
  data?: unknown,
  options: SafeFetchOptions = {}
): Promise<T | null> {
  try {
    const result = await apiClient.post<T>(url, data, options)

    if (result.ok) {
      return result.value.data
    } else {
      return null
    }
  } catch {
    return null
  }
}

/**
 * 安全PUT请求
 */
export async function safePut<T = unknown>(
  url: string,
  data?: unknown,
  options: SafeFetchOptions = {}
): Promise<T | null> {
  try {
    const result = await apiClient.put<T>(url, data, options)

    if (result.ok) {
      return result.value.data
    } else {
      return null
    }
  } catch {
    return null
  }
}

/**
 * 安全DELETE请求
 */
export async function safeDelete<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<T | null> {
  try {
    const result = await apiClient.delete<T>(url, options)

    if (result.ok) {
      return result.value.data
    } else {
      return null
    }
  } catch {
    return null
  }
}

/**
 * 批量安全请求
 */
export async function safeBatchFetch<T = unknown>(
  requests: Array<{
    url: string
    options?: SafeFetchOptions
  }>
): Promise<Array<T | null>> {
  const promises = requests.map(({ url, options }) => safeJsonFetch<T>(url, options))

  return Promise.all(promises)
}

/**
 * 带超时的安全请求
 */
export async function safeFetchWithTimeout<T = unknown>(
  url: string,
  timeout: number,
  options: SafeFetchOptions = {}
): Promise<T | null> {
  return safeJsonFetch<T>(url, { ...options, timeout })
}

/**
 * 带重试的安全请求
 */
export async function safeFetchWithRetry<T = unknown>(
  url: string,
  retries: number = 3,
  options: SafeFetchOptions = {}
): Promise<T | null> {
  return safeJsonFetch<T>(url, { ...options, retries })
}
