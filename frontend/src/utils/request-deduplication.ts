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

/**
 * 创建带去重的函数包装器
 *
 * @param fn - 要包装的函数
 * @param keyGenerator - 生成请求 key 的函数
 * @param cacheDuration - 缓存时间（毫秒）
 * @returns 包装后的函数
 *
 * @example
 * ```typescript
 * const fetchUserWithDedup = createDedupWrapper(
 *   fetchUser,
 *   (userId) => `fetch-user-${userId}`,
 *   1000
 * )
 *
 * // 这两个调用会共享同一个请求
 * const user1 = fetchUserWithDedup(123)
 * const user2 = fetchUserWithDedup(123)
 * ```
 */
export function createDedupWrapper<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  keyGenerator: (...args: TArgs) => string,
  cacheDuration?: number
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => {
    const key = keyGenerator(...args)
    return requestDeduplication.execute(key, () => fn(...args), cacheDuration)
  }
}

/**
 * 可取消的 Promise 包装器
 */
export class CancellablePromise<T> {
  private promise: Promise<T>
  private cancelled = false
  private cancelCallbacks: Array<() => void> = []

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (reason?: unknown) => void,
      onCancel: (callback: () => void) => void
    ) => void
  ) {
    this.promise = new Promise<T>((resolve, reject) => {
      const onCancel = (callback: () => void) => {
        this.cancelCallbacks.push(callback)
      }

      executor(
        value => {
          if (!this.cancelled) {
            resolve(value)
          }
        },
        reason => {
          if (!this.cancelled) {
            reject(reason)
          }
        },
        onCancel
      )
    })
  }

  /**
   * 取消 Promise
   */
  cancel(): void {
    if (this.cancelled) return

    this.cancelled = true

    // 执行所有取消回调
    this.cancelCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        logger.warn('CancellablePromise', '取消回调执行失败', error)
      }
    })

    logger.debug('CancellablePromise', '✅ Promise 已取消')
  }

  /**
   * 获取 Promise
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected)
  }

  /**
   * 捕获错误
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.promise.catch(onrejected)
  }

  /**
   * 最终执行
   */
  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.promise.finally(onfinally)
  }

  /**
   * 是否已取消
   */
  get isCancelled(): boolean {
    return this.cancelled
  }
}

/**
 * 创建可取消的 Promise
 *
 * @param executor - Promise 执行器
 * @returns 可取消的 Promise
 *
 * @example
 * ```typescript
 * const promise = createCancellablePromise((resolve, reject, onCancel) => {
 *   const timer = setTimeout(() => resolve('done'), 1000)
 *   onCancel(() => clearTimeout(timer))
 * })
 *
 * // 取消
 * promise.cancel()
 * ```
 */
export function createCancellablePromise<T>(
  executor: (
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void,
    onCancel: (callback: () => void) => void
  ) => void
): CancellablePromise<T> {
  return new CancellablePromise(executor)
}
