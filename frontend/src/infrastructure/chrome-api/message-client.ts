/**
 * Chrome 扩展消息通信客户端 - 基础设施层
 *
 * 职责：
 * - 封装 Chrome 扩展消息通信 API
 * - 提供超时控制和重试机制
 * - 处理扩展上下文不可用的情况
 * - 提供类型安全的消息接口
 */

import type { Result } from '../../core/common/result'
import { ok, err } from '../../core/common/result'

/**
 * 消息选项
 */
export interface MessageOptions {
  timeoutMs?: number
  retries?: number
  backoffMs?: number
}

/**
 * 消息类型定义
 */
export interface Message {
  type: string
  data?: unknown
}

/**
 * 消息响应
 */
export interface MessageResponse<T = unknown> {
  ok: boolean
  value?: T
  error?: string
  meta?: unknown
}

/**
 * Chrome 扩展消息通信客户端
 */
export class ChromeMessageClient {
  private defaultOptions: Required<MessageOptions>

  constructor(defaultOptions: MessageOptions = {}) {
    this.defaultOptions = {
      timeoutMs: 30000, // 增加到30秒，避免大数据首次初始化超时
      retries: 0, // 关闭重试，避免10/20/30s风暴式重试
      backoffMs: 300,
      ...defaultOptions
    }
  }

  /**
   * 发送消息到后台脚本
   */
  async sendMessage<T = unknown>(
    message: Message,
    options: MessageOptions = {}
  ): Promise<Result<MessageResponse<T>, Error>> {
    const opts = { ...this.defaultOptions, ...options }

    try {
      const response = await this.sendWithRetry(message, opts)
      return ok(response as MessageResponse<T>)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 带重试的消息发送
   */
  private async sendWithRetry(
    message: Message,
    options: Required<MessageOptions>
  ): Promise<MessageResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        return await this.sendWithTimeout(message, options.timeoutMs)
      } catch (error) {
        lastError = error as Error

        if (attempt < options.retries) {
          const waitMs = options.backoffMs * Math.pow(2, attempt)
          await this.delay(waitMs)
        }
      }
    }

    throw lastError || new Error('Message sending failed')
  }

  /**
   * 带超时的消息发送
   */
  private async sendWithTimeout(message: Message, timeoutMs: number): Promise<MessageResponse> {
    return new Promise((resolve, reject) => {
      if (!this.isExtensionContextAvailable()) {
        return reject(new Error('Extension context not available'))
      }

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error(`Message timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      try {
        chrome.runtime.sendMessage(message, response => {
          if (settled) return
          settled = true
          clearTimeout(timer)

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          resolve(response || { ok: true })
        })
      } catch (error) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
      }
    })
  }

  /**
   * 检查扩展上下文是否可用
   */
  private isExtensionContextAvailable(): boolean {
    return !!chrome?.runtime?.id
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 分页获取所有书签
   */
  async getBookmarksPaged(
    limit?: number,
    offset?: number,
    options: MessageOptions = {}
  ): Promise<Result<MessageResponse, Error>> {
    return this.sendMessage(
      {
        type: 'get-bookmarks-paged',
        data: { limit, offset }
      },
      options
    )
  }

  /**
   * 分页获取子书签
   */
  async getChildrenPaged(
    parentId: string,
    limit?: number,
    offset?: number,
    options: MessageOptions = {}
  ): Promise<Result<MessageResponse, Error>> {
    return this.sendMessage(
      {
        type: 'get-children-paged',
        data: { parentId, limit, offset }
      },
      options
    )
  }

  /**
   * 获取统计信息
   */
  async getStats(options: MessageOptions = {}): Promise<Result<MessageResponse, Error>> {
    return this.sendMessage(
      {
        type: 'GET_STATS'
      },
      options
    )
  }

  /**
   * 触发后台执行全量书签同步。
   *
   * @param options 消息发送配置，可覆盖默认超时时间等参数
   * @returns 后台响应的结果，包含同步是否已启动或正在进行的元信息
   */
  async syncBookmarks(
    options: MessageOptions = {}
  ): Promise<Result<MessageResponse<{ started: boolean }>, Error>> {
    const mergedOptions: MessageOptions = {
      timeoutMs: Math.max(options.timeoutMs ?? 45_000, this.defaultOptions.timeoutMs),
      ...options
    }
    return this.sendMessage(
      {
        type: 'SYNC_BOOKMARKS'
      },
      mergedOptions
    )
  }

  /**
   * 执行清理扫描
   */
  async startCleanupScan(
    settings: Record<string, unknown>,
    options: MessageOptions = {}
  ): Promise<Result<MessageResponse, Error>> {
    return this.sendMessage(
      {
        type: 'START_CLEANUP_SCAN',
        data: { settings }
      },
      options
    )
  }

  /**
   * 停止清理扫描
   */
  async stopCleanupScan(options: MessageOptions = {}): Promise<Result<MessageResponse, Error>> {
    return this.sendMessage(
      {
        type: 'STOP_CLEANUP_SCAN'
      },
      options
    )
  }

  /**
   * 设置配置选项
   */
  setOptions(options: MessageOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options }
  }

  /**
   * 获取当前配置
   */
  getOptions(): Required<MessageOptions> {
    return { ...this.defaultOptions }
  }
}

/**
 * 默认消息客户端实例
 */
export const messageClient = new ChromeMessageClient()

/**
 * 便捷的消息发送函数（保持向后兼容）
 */
export async function sendMessageToBackend(
  message: Message,
  options: MessageOptions = {}
): Promise<MessageResponse> {
  const result = await messageClient.sendMessage(message, options)
  if (result.ok) {
    return result.value
  }
  throw result.error
}

/**
 * 便捷的分页获取书签函数（保持向后兼容）
 */
export async function getBookmarksPaged(
  limit?: number,
  offset?: number,
  options: MessageOptions = {}
): Promise<MessageResponse> {
  const result = await messageClient.getBookmarksPaged(limit, offset, options)
  if (result.ok) {
    return result.value
  }
  throw result.error
}

/**
 * 便捷的分页获取子书签函数（保持向后兼容）
 */
export async function getChildrenPaged(
  parentId: string,
  limit?: number,
  offset?: number,
  options: MessageOptions = {}
): Promise<MessageResponse> {
  const result = await messageClient.getChildrenPaged(parentId, limit, offset, options)
  if (result.ok) {
    return result.value
  }
  throw result.error
}
