/**
 * Result 类型 - 统一错误处理模式
 *
 * 设计目标：
 * - 统一异步操作的错误处理
 * - 避免异常传播，明确错误类型
 * - 提供类型安全的错误处理
 *
 * 受 Rust Result<T, E> 启发，提供函数式错误处理方式
 */

/**
 * Result 类型定义
 *
 * 表示可能成功或失败的操作结果
 *
 * @template T - 成功时的值类型
 * @template E - 失败时的错误类型，默认为 Error
 */
export type Result<T, E = Error> =
  | { ok: true; value: T; error?: never }
  | { ok: false; error: E; value?: never };

/**
 * 创建成功结果
 *
 * @param value - 成功时的值
 * @returns 包含成功值的 Result 对象
 */
export function ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value };
}

/**
 * 创建错误结果
 *
 * @param error - 错误对象
 * @returns 包含错误的 Result 对象
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * 类型守卫：检查是否为成功结果
 *
 * @param result - 待检查的 Result 对象
 * @returns 如果是成功结果返回 true，否则返回 false
 */
export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok === true;
}

/**
 * 类型守卫：检查是否为错误结果
 *
 * @param result - 待检查的 Result 对象
 * @returns 如果是错误结果返回 true，否则返回 false
 */
export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return result.ok === false;
}

/**
 * 解包结果，成功时返回值，失败时抛出错误
 *
 * @param result - Result 对象
 * @returns 成功时的值
 * @throws 失败时抛出错误
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw result.error;
}

/**
 * 解包结果，失败时返回默认值
 *
 * @param result - Result 对象
 * @param defaultValue - 失败时使用的默认值
 * @returns 成功时的值或默认值
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * 解包结果，失败时执行回调函数
 *
 * @param result - Result 对象
 * @param callback - 失败时执行的回调函数，接收错误并返回替代值
 * @returns 成功时的值或回调函数返回的值
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  callback: (error: E) => T,
): T {
  return result.ok ? result.value : callback(result.error);
}

/**
 * 映射成功值
 *
 * 对成功结果应用转换函数，错误结果保持不变
 *
 * @param result - Result 对象
 * @param mapper - 转换函数
 * @returns 转换后的 Result 对象
 */
export function map<T, U, E = Error>(
  result: Result<T, E>,
  mapper: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return ok(mapper(result.value));
  }
  // 类型断言是安全的，因为我们知道 result.ok 为 false
  return result as unknown as Result<U, E>;
}

/**
 * 映射错误值
 *
 * 对错误结果应用转换函数，成功结果保持不变
 *
 * @param result - Result 对象
 * @param mapper - 错误转换函数
 * @returns 转换后的 Result 对象
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  mapper: (error: E) => F,
): Result<T, F> {
  if (result.ok) {
    return result;
  }
  return err(mapper(result.error));
}

/**
 * 链式操作（flatMap）
 *
 * 对成功结果应用返回 Result 的函数，实现链式调用
 *
 * @param result - Result 对象
 * @param mapper - 转换函数，返回新的 Result
 * @returns 转换后的 Result 对象
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return mapper(result.value);
  }
  return result as Result<U, E>;
}
