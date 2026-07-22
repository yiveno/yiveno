/** 应用层统一操作结果。 */
export type Result<T, E extends Error = Error> = { ok: true; value: T } | { ok: false; error: E }

/** 创建成功结果。 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

/** 创建失败结果。 */
export function err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error }
}
