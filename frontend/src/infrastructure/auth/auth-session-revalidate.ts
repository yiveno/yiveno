/**
 * 扩展侧 Auth 存活校验（节流）：用 refresh 探测 refresh_token 是否仍有效。
 * 官网 signOut 后 refresh 通常失效；仅靠未过期 access 会误判仍登录。
 */

import type { AuthSession } from '@/core/identity/auth-session'
import { refreshAuthSession } from '@/infrastructure/auth/extension-oauth'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** chrome.storage.session：上次成功/完成校验的时间戳（ms）。 */
export const AUTH_LAST_VALIDATED_AT_KEY = 'yiveno:auth_last_validated_at' as const

/** 两次网络校验最小间隔，避免 Popup/storage 连环触发。 */
export const AUTH_REVALIDATE_MIN_INTERVAL_MS = 5 * 60 * 1000

/** 清除校验时间戳（登录 handoff / 退出后强制下次校验）。 */
export async function clearAuthValidationTimestamp(): Promise<void> {
  await chrome.storage.session.remove(AUTH_LAST_VALIDATED_AT_KEY)
}

/** 标记刚刚完成一次校验。 */
export async function markAuthValidatedNow(): Promise<void> {
  await chrome.storage.session.set({ [AUTH_LAST_VALIDATED_AT_KEY]: Date.now() })
}

/** 是否已到节流窗口，需要再次网络校验。 */
export async function shouldRevalidateAuthSession(): Promise<boolean> {
  const result = await chrome.storage.session.get(AUTH_LAST_VALIDATED_AT_KEY)
  const last = result[AUTH_LAST_VALIDATED_AT_KEY]
  if (typeof last !== 'number' || !Number.isFinite(last)) {
    return true
  }
  return Date.now() - last >= AUTH_REVALIDATE_MIN_INTERVAL_MS
}

export type AuthRevalidateResult =
  | { status: 'skipped' } // 节流跳过
  | { status: 'valid'; session: AuthSession } // refresh 成功
  | { status: 'invalid' } // refresh 失败，应清本地登录态

/**
 * 节流后尝试 refresh；成功则返回新 session，失败则 invalid。
 * 调用方负责写入 storage 或执行 keep_local 退登。
 */
export async function revalidateAuthSession(
  session: AuthSession,
  options: { force?: boolean } = {}
): Promise<AuthRevalidateResult> {
  if (!options.force && !(await shouldRevalidateAuthSession())) {
    return { status: 'skipped' }
  }

  const startedAt = flowStart('Auth', 'revalidate session')
  const refreshed = await refreshAuthSession(session.refreshToken, {
    ...(session.email ? { email: session.email } : {}),
    ...(session.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
    ...(session.displayName ? { displayName: session.displayName } : {})
  })

  await markAuthValidatedNow()

  if (!refreshed) {
    flowFail('Auth', 'revalidate session', startedAt, new Error('refresh_invalid'))
    return { status: 'invalid' }
  }

  flowOk('Auth', 'revalidate session', startedAt, { userId: refreshed.userId })
  return { status: 'valid', session: refreshed }
}
