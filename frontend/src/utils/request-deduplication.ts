/**
 * 请求去重工具
 *
 * 防止相同的请求并发执行，提升性能
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 请求缓存项
 */
interface RequestCacheItem<T> {
  /** 请求 Promise */
  promise: Promise<T>
  /** 创建时间 */
  timestamp: number
}

/**
 * 请求去重管理器
 */
class RequestDeduplicationManager {
  /** 请求缓存 Map */
  private cache = new Map<string, RequestCacheItem<unknown>>()

  /** 默认缓存时间（毫秒） */
  private defaultCacheDuration = 100

  /**
   * 执行去重请求
   *
   * @param key - 请求唯一标识
   * @param fn - 请求函数
   * @param cacheDuration - 缓存时间（毫秒），默认 100ms
   * @returns 请求结果
   *
   * @example
   * ```typescript
   * const data = await requestDeduplication.execute(
   *   'fetch-user-123',
   *   () => fetchUser(123),
   *   1000
   * )
   * ```
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    cacheDuration: number = this.defaultCacheDuration
  ): Promise<T> {
    const now = Date.now()
    const cached = this.cache.get(key)

    // 如果有缓存且未过期，返回缓存的 Promise
    if (cached && now - cached.timestamp < cacheDuration) {
      logger.debug('RequestDeduplication', `♻️ 复用进行中的请求: ${key}`)
      return cached.promise as Promise<T>
    }

    // 创建新请求
    logger.debug('RequestDeduplication', `🚀 创建新请求: ${key}`)
    const promise = fn()

    // 缓存请求
    this.cache.set(key, {
      promise,
      timestamp: now
    })

    // 请求完成后清理缓存
    promise
      .then(() => {
        this.cleanupCache(key, cacheDuration)
      })
      .catch(() => {
        // 请求失败立即清理，允许重试
        this.cache.delete(key)
        logger.debug('RequestDeduplication', `❌ 请求失败，清理缓存: ${key}`)
      })

    return promise
  }

  /**
   * 清理过期缓存
   *
   * @param key - 请求标识
   * @param cacheDuration - 缓存时间
   */
  private cleanupCache(key: string, cacheDuration: number): void {
    setTimeout(() => {
      this.cache.delete(key)
      logger.debug('RequestDeduplication', `🧹 清理缓存: ${key}`)
    }, cacheDuration)
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
    logger.debug('RequestDeduplication', '🧹 清除所有缓存')
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size
  }
}

/**
 * 全局请求去重管理器实例
 */
export const requestDeduplication = new RequestDeduplicationManager()
