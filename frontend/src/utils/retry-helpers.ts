/**
 * 重试辅助工具
 *
 * 提供统一的错误处理和重试机制
 */

import { logger } from "@/infrastructure/logging/logger";

/**
 * 重试配置
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  delay?: number;
  /** 延迟倍增因子（指数退避） */
  backoffFactor?: number;
  /** 是否应该重试的判断函数 */
  shouldRetry?: (error: unknown) => boolean;
  /** 操作名称（用于日志） */
  operationName?: string;
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  delay: 1000,
  backoffFactor: 2,
  shouldRetry: () => true,
  operationName: "operation",
};

/**
 * 带重试的异步操作包装器
 *
 * @param fn - 要执行的异步函数
 * @param options - 重试配置
 * @returns 执行结果
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, delay: 1000, operationName: '获取数据' }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // 第一次尝试或重试
      if (attempt > 0) {
        const delay = opts.delay * Math.pow(opts.backoffFactor, attempt - 1);
        logger.info(
          "RetryHelper",
          `🔄 重试 ${opts.operationName} (第 ${attempt}/${opts.maxRetries} 次)，延迟 ${delay}ms`,
        );
        await sleep(delay);
      }

      const result = await fn();

      // 成功
      if (attempt > 0) {
        logger.info(
          "RetryHelper",
          `✅ ${opts.operationName} 重试成功 (第 ${attempt} 次尝试)`,
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      // 判断是否应该重试
      if (!opts.shouldRetry(error)) {
        logger.warn(
          "RetryHelper",
          `❌ ${opts.operationName} 失败，不应重试`,
          error,
        );
        throw error;
      }

      // 如果已达到最大重试次数，抛出错误
      if (attempt >= opts.maxRetries) {
        logger.error(
          "RetryHelper",
          `❌ ${opts.operationName} 失败，已达到最大重试次数 (${opts.maxRetries})`,
          error,
        );
        throw error;
      }

      // 记录错误，继续重试
      logger.warn(
        "RetryHelper",
        `⚠️ ${opts.operationName} 失败 (第 ${attempt + 1} 次尝试)`,
        error,
      );
    }
  }

  // 理论上不会到这里，但为了类型安全
  throw lastError;
}

/**
 * 延迟函数
 *
 * @param ms - 延迟毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建一个带重试的函数包装器
 *
 * @param fn - 要包装的函数
 * @param options - 重试配置
 * @returns 包装后的函数
 *
 * @example
 * ```typescript
 * const fetchDataWithRetry = createRetryWrapper(
 *   fetchData,
 *   { maxRetries: 3, operationName: '获取数据' }
 * )
 *
 * const data = await fetchDataWithRetry()
 * ```
 */
export function createRetryWrapper<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {},
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => {
    return withRetry(() => fn(...args), options);
  };
}

/**
 * 判断错误是否为网络错误
 *
 * @param error - 错误对象
 * @returns 是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("network") ||
      error.message.includes("fetch") ||
      error.message.includes("timeout") ||
      error.name === "NetworkError" ||
      error.name === "TimeoutError"
    );
  }
  return false;
}

/**
 * 判断错误是否为数据库错误
 *
 * @param error - 错误对象
 * @returns 是否为数据库错误
 */
export function isDatabaseError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("database") ||
      error.message.includes("IndexedDB") ||
      error.name === "DatabaseError" ||
      error.name === "QuotaExceededError"
    );
  }
  return false;
}

/**
 * 判断错误是否应该重试
 *
 * @param error - 错误对象
 * @returns 是否应该重试
 */
export function shouldRetryError(error: unknown): boolean {
  // 网络错误应该重试
  if (isNetworkError(error)) {
    return true;
  }

  // 数据库锁定错误应该重试
  if (isDatabaseError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("locked") || message.includes("busy")) {
      return true;
    }
  }

  // 其他错误不重试
  return false;
}
