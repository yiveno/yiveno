/**
 * Result 类型 - 统一错误处理模式
 */

export type Result<T, E = Error> =
  | { ok: true; value: T; error?: never }
  | { ok: false; error: E; value?: never }

/** 创建成功结果 */
export function ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value }
}

/** 创建错误结果 */
export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error }
}
