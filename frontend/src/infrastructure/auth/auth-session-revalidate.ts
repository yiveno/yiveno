/**
 * 扩展侧 Auth 存活校验（节流）：用 refresh 探测 refresh_token 是否仍有效。
 * 官网 signOut 后 refresh 通常失效；仅靠未过期 access 会误判仍登录。
 *
 * 重要：网络/5xx 等瞬时失败不得清登录态（否则会出现「官网仍登录、扩展被踢成未登录」）。
 * 并发 GET_AUTH_STATE 共用一次 refresh（single-flight），避免 Already Used 误踢。
 */

import type { AuthSession } from '@/core/identity/auth-session'
import { refreshAuthSessionDetailed } from '@/infrastructure/auth/extension-oauth'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** chrome.storage.session：上次成功/完成校验的时间戳（ms）。 */
export const AUTH_LAST_VALIDATED_AT_KEY = 'yiveno:auth_last_validated_at' as const

/** 两次网络校验最小间隔，避免 Popup/storage 连环触发。 */
export const AUTH_REVALIDATE_MIN_INTERVAL_MS = 5 * 60 * 1000

/** 进行中的 revalidate（同 refreshToken 合并为一次网络调用）。 */
let revalidateInflight: {
  refreshToken: string
  promise: Promise<AuthRevalidateResult>
} | null = null

/** 清除校验时间戳（登录 handoff / 退出后强制下次校验）。 */
export async function clearAuthValidationTimestamp(): Promise<void> {
  await chrome.storage.session.remove(AUTH_LAST_VALIDATED_AT_KEY)
}

/** 标记刚刚完成一次成功校验。 */
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
  | { status: 'invalid'; reason: string } // refresh 明确作废，应清本地登录态
  | { status: 'uncertain'; reason: string } // 瞬时失败，保留本地登录态并下次再试

/**
 * Already Used / 瞬时失败后：若存储里已是更新后的 refresh（并发赢家已写入），采信之。
 */
async function recoverSessionIfRotated(attemptedRefreshToken: string): Promise<AuthSession | null> {
  const stored = await getAuthSession()
  if (!stored) {
    return null
  }
  if (stored.refreshToken === attemptedRefreshToken) {
    return null
  }
  return stored
}

async function runRevalidateAuthSession(session: AuthSession): Promise<AuthRevalidateResult> {
  const startedAt = flowStart('Auth', 'revalidate session')
  let refreshed: Awaited<ReturnType<typeof refreshAuthSessionDetailed>>
  try {
    refreshed = await refreshAuthSessionDetailed(session.refreshToken, {
      ...(session.email ? { email: session.email } : {}),
      ...(session.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
      ...(session.displayName ? { displayName: session.displayName } : {})
    })
  } catch (error) {
    // 兜底：refresh 实现不应再抛；若抛出则保留本地登录态
    const reason = error instanceof Error ? error.message : 'revalidate_threw'
    const recovered = await recoverSessionIfRotated(session.refreshToken)
    if (recovered) {
      await markAuthValidatedNow()
      flowOk('Auth', 'revalidate session', startedAt, {
        userId: recovered.userId,
        recoveredAfterThrow: true
      })
      return { status: 'valid', session: recovered }
    }
    flowFail('Auth', 'revalidate session', startedAt, error, { outcome: 'uncertain' })
    return { status: 'uncertain', reason }
  }

  if (refreshed.status === 'ok') {
    await markAuthValidatedNow()
    flowOk('Auth', 'revalidate session', startedAt, { userId: refreshed.session.userId })
    return { status: 'valid', session: refreshed.session }
  }

  if (refreshed.status === 'invalid') {
    // 明确作废才标记，避免反复打无效 refresh；调用方会清 session
    await markAuthValidatedNow()
    flowFail('Auth', 'revalidate session', startedAt, new Error(refreshed.reason), {
      outcome: 'invalid'
    })
    return { status: 'invalid', reason: refreshed.reason }
  }

  // transient（含 Already Used）：若并发另一路已写入新 token，采信存储，勿误踢
  const recovered = await recoverSessionIfRotated(session.refreshToken)
  if (recovered) {
    await markAuthValidatedNow()
    flowOk('Auth', 'revalidate session', startedAt, {
      userId: recovered.userId,
      recoveredAfterTransient: true,
      reason: refreshed.reason
    })
    return { status: 'valid', session: recovered }
  }

  // 不 mark，下次打开 Popup 可再试
  flowFail('Auth', 'revalidate session', startedAt, new Error(refreshed.reason), {
    outcome: 'uncertain'
  })
  return { status: 'uncertain', reason: refreshed.reason }
}

/**
 * 节流后尝试 refresh。
 * - valid：写回新 session
 * - invalid：调用方 keep_local 退登
 * - uncertain：调用方保留原 session，且不标记已校验（便于尽快重试）
 * 同 refreshToken 并发调用合并为一次网络请求（single-flight）。
 */
export async function revalidateAuthSession(
  session: AuthSession,
  options: { force?: boolean } = {}
): Promise<AuthRevalidateResult> {
  if (!options.force && !(await shouldRevalidateAuthSession())) {
    return { status: 'skipped' }
  }

  const token = session.refreshToken
  if (revalidateInflight && revalidateInflight.refreshToken === token) {
    return revalidateInflight.promise
  }

  const promise = runRevalidateAuthSession(session).finally(() => {
    if (revalidateInflight?.promise === promise) {
      revalidateInflight = null
    }
  })
  revalidateInflight = { refreshToken: token, promise }
  return promise
}
