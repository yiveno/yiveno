/**
 * 扩展侧旧 Supabase Auth 存活校验（节流）：仅 refresh。
 * D 方案：租约探测已删除；持 device_session 的主路径不走本模块。
 * 迁移窗内仍可能对 yiveno:auth_session 做 refresh。
 *
 * 重要：网络/5xx / rate limit 等瞬时失败不得清登录态。
 * 并发 GET_AUTH_STATE 共用一次校验（single-flight），避免 Already Used 误踢。
 */

import type { AuthSession } from '@/core/identity/auth-session'
import { refreshAuthSessionDetailed } from '@/infrastructure/auth/extension-oauth'
import { getAuthSession, setAuthSession } from '@/infrastructure/identity/auth-session-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/** chrome.storage.session：上次成功/完成校验的时间戳（ms）。 */
export const AUTH_LAST_VALIDATED_AT_KEY = 'yiveno:auth_last_validated_at' as const

/** 两次完整校验（refresh）最小间隔。 */
export const AUTH_REVALIDATE_MIN_INTERVAL_MS = 5 * 60 * 1000

/** GET_AUTH_STATE 强制路径：refresh 最短间隔（减轻 Supabase rate limit）。 */
export const AUTH_REFRESH_MIN_INTERVAL_MS = 60 * 1000

/** chrome.storage.session：上次成功 refresh 的时间戳。 */
export const AUTH_LAST_REFRESHED_AT_KEY = 'yiveno:auth_last_refreshed_at' as const

/** 进行中的 revalidate（同 refreshToken 合并为一次网络调用）。 */
let revalidateInflight: {
  refreshToken: string
  promise: Promise<AuthRevalidateResult>
} | null = null

/** 清除校验时间戳（登录 handoff / 退出后强制下次校验）。 */
export async function clearAuthValidationTimestamp(): Promise<void> {
  await chrome.storage.session.remove([AUTH_LAST_VALIDATED_AT_KEY, AUTH_LAST_REFRESHED_AT_KEY])
}

/** 标记刚刚完成一次成功校验。 */
export async function markAuthValidatedNow(): Promise<void> {
  await chrome.storage.session.set({ [AUTH_LAST_VALIDATED_AT_KEY]: Date.now() })
}

async function markAuthRefreshedNow(): Promise<void> {
  await chrome.storage.session.set({ [AUTH_LAST_REFRESHED_AT_KEY]: Date.now() })
}

async function shouldRefreshAuthSession(): Promise<boolean> {
  const result = await chrome.storage.session.get(AUTH_LAST_REFRESHED_AT_KEY)
  const last = result[AUTH_LAST_REFRESHED_AT_KEY]
  if (typeof last !== 'number' || !Number.isFinite(last)) {
    return true
  }
  return Date.now() - last >= AUTH_REFRESH_MIN_INTERVAL_MS
}

function isRateLimitReason(reason: string): boolean {
  const lower = reason.toLowerCase()
  return lower.includes('rate limit') || lower.includes('over_request_rate_limit')
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

function isAlreadyUsedRefreshReason(reason: string): boolean {
  const lower = reason.toLowerCase()
  return lower.includes('already used') || lower.includes('refresh_token_already_used')
}

async function runRevalidateAuthSession(
  session: AuthSession,
  options: { force?: boolean } = {}
): Promise<AuthRevalidateResult> {
  const startedAt = flowStart('Auth', 'revalidate session')

  // force 路径：refresh 仍节流，避免连点/多面板打爆 token 端
  const needRefresh = options.force ? await shouldRefreshAuthSession() : true
  if (!needRefresh) {
    await markAuthValidatedNow()
    flowOk('Auth', 'revalidate session', startedAt, {
      userId: session.userId,
      skippedRefresh: true
    })
    return { status: 'valid', session }
  }

  let refreshed: Awaited<ReturnType<typeof refreshAuthSessionDetailed>>
  try {
    refreshed = await refreshAuthSessionDetailed(session.refreshToken, {
      ...(session.email ? { email: session.email } : {}),
      ...(session.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
      ...(session.displayName ? { displayName: session.displayName } : {})
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'revalidate_threw'
    const recovered = await recoverSessionIfRotated(session.refreshToken)
    if (recovered) {
      await markAuthValidatedNow()
      await markAuthRefreshedNow()
      flowOk('Auth', 'revalidate session', startedAt, {
        userId: recovered.userId,
        recoveredAfterThrow: true
      })
      return { status: 'valid', session: recovered }
    }
    if (isRateLimitReason(reason)) {
      logger.warn('Auth', 'revalidate session：限流，保留登录态', { reason })
    } else {
      flowFail('Auth', 'revalidate session', startedAt, new Error(reason), {
        outcome: 'uncertain'
      })
    }
    return { status: 'uncertain', reason }
  }

  if (refreshed.status === 'ok') {
    await setAuthSession(refreshed.session)
    await markAuthValidatedNow()
    await markAuthRefreshedNow()
    flowOk('Auth', 'revalidate session', startedAt, { userId: refreshed.session.userId })
    return { status: 'valid', session: refreshed.session }
  }

  if (refreshed.status === 'invalid') {
    await markAuthValidatedNow()
    flowFail('Auth', 'revalidate session', startedAt, new Error(refreshed.reason), {
      outcome: 'invalid'
    })
    return { status: 'invalid', reason: refreshed.reason }
  }

  const recovered = await recoverSessionIfRotated(session.refreshToken)
  if (recovered) {
    await markAuthValidatedNow()
    await markAuthRefreshedNow()
    flowOk('Auth', 'revalidate session', startedAt, {
      userId: recovered.userId,
      recoveredAfterTransient: true,
      reason: refreshed.reason
    })
    return { status: 'valid', session: recovered }
  }

  if (isAlreadyUsedRefreshReason(refreshed.reason)) {
    await markAuthValidatedNow()
    flowFail('Auth', 'revalidate session', startedAt, new Error(refreshed.reason), {
      outcome: 'invalid',
      detail: 'already_used_unrecoverable'
    })
    return { status: 'invalid', reason: refreshed.reason }
  }

  if (isRateLimitReason(refreshed.reason)) {
    logger.warn('Auth', 'revalidate session：限流，保留登录态', {
      reason: refreshed.reason,
      durationMs: Date.now() - startedAt
    })
  } else {
    flowFail('Auth', 'revalidate session', startedAt, new Error(refreshed.reason), {
      outcome: 'uncertain'
    })
  }
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

  const promise = runRevalidateAuthSession(session, options).finally(() => {
    if (revalidateInflight?.promise === promise) {
      revalidateInflight = null
    }
  })
  revalidateInflight = { refreshToken: token, promise }
  return promise
}
