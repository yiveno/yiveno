/**
 * 通过 Background Script 代理 API 请求
 *
 * 用途：绕过 Chrome Extension 的 CSP 限制
 * Background Script 不受 CSP 限制，可以自由访问任何 HTTP/HTTPS 端点
 *
 * @param url - API 端点 URL
 * @param options - 请求选项
 * @returns Promise<Response 数据>
 */
import { extractErrorCode, getErrorMessage } from './error-codes'
import { logger } from '@/infrastructure/logging/logger'

export async function proxyApiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    // 处理 headers：如果是 Headers 对象，转换为普通对象
    let headers: Record<string, string> = {}
    if (options.headers) {
      if (options.headers instanceof Headers) {
        headers = Object.fromEntries(options.headers.entries())
      } else if (Array.isArray(options.headers)) {
        headers = Object.fromEntries(options.headers)
      } else {
        headers = options.headers as Record<string, string>
      }
    }

    const apiResponse = await new Promise<{
      success: boolean
      status: number
      statusText: string
      data: T
      error?: string
    }>((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'PROXY_API_REQUEST',
          data: {
            url,
            method: options.method || 'GET',
            headers,
            body: options.body
          }
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(
              response as {
                success: boolean
                status: number
                statusText: string
                data: T
                error?: string
              }
            )
          }
        }
      )
    })

    // 处理 HTTP 错误响应（4xx, 5xx）
    if (apiResponse.status >= 400) {
      // 从响应数据中提取错误码
      const errorCode = extractErrorCode(apiResponse.data)

      // 根据错误码获取对应的错误文案
      const errorMessage = getErrorMessage(
        errorCode,
        `HTTP ${apiResponse.status}: ${apiResponse.statusText}`
      )

      throw new Error(errorMessage)
    }

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || '请求失败')
    }

    return apiResponse.data
  } catch (error) {
    logger.error('ProxyAPI', 'Request', '代理 API 请求失败', error)
    // 如果是已经包含错误信息的 Error，直接抛出
    if (error instanceof Error) {
      throw error
    }
    // 其他错误返回 null（保持向后兼容）
    return null
  }
}
