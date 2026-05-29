/**
 * IndexedDB 事务管理器
 *
 * 职责与设计：
 * - 提供统一的事务包装器 `withTransaction`，确保回调逻辑与事务生命周期一致
 * - 支持只读/读写两种模式，并在业务回调完成后由 `oncomplete` 统一 resolve
 * - 在发生 `abort/error` 时抛出明确错误，并支持有限重试（指数退避由调用方控制）
 * - 不做隐式降级或兜底写入，保持事务一致性由调用方保障
 *
 * 特性：
 * - 自动重试失败的事务
 * - 事件驱动的异步处理
 * - 统一的错误处理
 * - 可配置的重试策略
 */

import { idbConnectionPool } from './connection-pool'

/**
 * IndexedDB 事务模式类型
 */
export type IDBTransactionMode = 'readonly' | 'readwrite'

/**
 * 事务选项接口
 */
export interface TransactionOptions {
  /** 重试次数，默认 0 */
  retries?: number
  /** 重试延迟（毫秒），默认 50 */
  retryDelayMs?: number
  /** 重试回调函数 */
  onRetry?: (attempt: number, error: unknown) => void
}

/**
 * 延迟执行
 *
 * @param ms - 延迟时间（毫秒）
 */
async function delay(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

/**
 * 在事务中执行操作
 *
 * 提供统一的事务包装，自动处理事务生命周期和错误重试
 *
 * @param stores - 参与事务的对象存储列表
 * @param mode - 事务模式（readonly/readwrite）
 * @param cb - 事务处理回调函数
 * @param options - 可选的事务配置（重试次数、延迟等）
 * @returns 回调函数的返回值
 * @throws 当事务失败且重试用尽时抛出错误
 */
export async function withTransaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  cb: (tx: IDBTransaction) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const retries = Math.max(0, options.retries ?? 0)
  const retryDelayMs = options.retryDelayMs ?? 50
  let attempt = 0

  while (true) {
    try {
      const db = idbConnectionPool.getDB()
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(stores, mode)
        let resultValue: T | undefined
        let cbErrored = false

        tx.oncomplete = () => {
          if (!cbErrored) resolve(resultValue as T)
        }
        tx.onerror = () => {
          cbErrored = true
          reject(tx.error)
        }
        tx.onabort = () => {
          cbErrored = true
          reject(tx.error || new Error('IndexedDB 事务已中止'))
        }

        // 执行业务回调，等待其完成后由 oncomplete 统一 resolve
        ;(async () => {
          try {
            resultValue = await cb(tx)
          } catch (err) {
            cbErrored = true
            try {
              tx.abort()
            } catch {}
            reject(err)
          }
        })()
      })
    } catch (error) {
      if (attempt < retries) {
        attempt++
        options.onRetry?.(attempt, error)
        await delay(retryDelayMs)
        continue
      }
      throw error
    }
  }
}
