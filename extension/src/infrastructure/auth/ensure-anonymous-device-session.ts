/**
 * 匿名设备会话：GoTrue signup → session_exchange → 只存 device token。
 *
 * 铁律修订（AN1）：signup 后待交换会话持久化于 `yiveno:pending_anon_session`，
 * exchange 失败可复用同一匿名用户；access 过期先 refresh，refresh 失败才重新 signup。
 * AN2：系统性 401 不删 pending，写独立熔断键 `yiveno:anon_exchange_401_backoff`（60min）；
 * 窗口内 ensure fail-open，避免反复 signup 刷孤儿。
 * 仍禁止：写 legacy `yiveno:auth_session`；用待交换会话调 AI（W1' N3：exchange 完成前不得发起 AI）。
 */

import type { DeviceSession } from '@/core/identity/device-session'
import { maskDeviceTokenForLog } from '@/core/identity/device-session'
import {
  ANON_EXCHANGE_401_BACKOFF_MS,
  PENDING_ANON_ACCESS_CLOCK_SKEW_MS,
  PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS,
  maskPendingAccessTokenForLog,
  type PendingAnonymousSession
} from '@/core/identity/pending-anonymous-session'
import {
  deviceSessionFromRegisterData,
  registerDeviceViaSessionExchange
} from '@/infrastructure/auth/device-register-api-client'
import { refreshAuthSessionDetailed } from '@/infrastructure/auth/extension-oauth'
import { getSupabasePublicConfig } from '@/infrastructure/auth/supabase-client'
import {
  clearAnonymousCaptchaRetryNeeded,
  getTurnstileToken,
  markAnonymousCaptchaRetryNeeded
} from '@/infrastructure/auth/turnstile-token-provider'
import {
  clearAnonExchange401Backoff,
  getAnonExchange401Backoff,
  recordAnonExchange401
} from '@/infrastructure/identity/anon-exchange-401-backoff-service'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import {
  getDeviceSession,
  setDeviceSession
} from '@/infrastructure/identity/device-session-service'
import {
  getAccountBinding,
  getOrCreateLocalProfile,
  setAccountBinding
} from '@/infrastructure/identity/local-profile-service'
import {
  clearPendingAnonymousSession,
  getPendingAnonymousSession,
  setPendingAnonymousSession
} from '@/infrastructure/identity/pending-anonymous-session-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

export type EnsureAnonymousDeviceSessionDeps = {
  getTurnstileToken: () => Promise<string | null>
  /** Settings 手动重试：绕过 exchange 退避 */
  ignoreBackoff?: boolean
  /** 测试钩：观测是否在 exchange 前误调 AI */
  onBeforeExchange?: () => void
  onAfterDeviceStored?: () => void
}

export type EnsureAnonymousResult =
  | { status: 'already'; session: DeviceSession }
  | { status: 'created'; session: DeviceSession }
  | { status: 'skipped_has_legacy' }
  | { status: 'failed'; error: string }

type GoTrueSignupSuccess = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  user?: { id?: string; is_anonymous?: boolean }
}

export type GoTrueSignupOk = {
  ok: true
  accessToken: string
  refreshToken?: string
  expiresIn: number
  userId: string
}

type ExchangeAttemptOutcome =
  EnsureAnonymousResult | { kind: 'auth_invalid' } | { kind: 'exchange_failed'; error: string }

/**
 * 裸 fetch GoTrue 匿名 signup（captcha 在 gotrue_meta_security 内）。
 * 成功返回 access / refresh / expires_in / userId；调用方写入待交换键（非 legacy auth_session）。
 */
export async function signupAnonymousWithGoTrue(
  captchaToken: string
): Promise<GoTrueSignupOk | { ok: false; error: string }> {
  const config = getSupabasePublicConfig()
  if (!config) {
    return { ok: false, error: 'supabase_config_missing' }
  }
  const url = `${config.url.replace(/\/$/, '')}/auth/v1/signup`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: config.anonKey,
        authorization: `Bearer ${config.anonKey}`
      },
      body: JSON.stringify({
        data: {},
        gotrue_meta_security: { captcha_token: captchaToken }
      })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error =
        typeof body === 'object' &&
        body !== null &&
        'error_code' in body &&
        typeof (body as { error_code: unknown }).error_code === 'string'
          ? (body as { error_code: string }).error_code
          : typeof body === 'object' &&
              body !== null &&
              'msg' in body &&
              typeof (body as { msg: unknown }).msg === 'string'
            ? (body as { msg: string }).msg
            : `http_${response.status}`
      return { ok: false, error }
    }
    const data = body as GoTrueSignupSuccess
    if (typeof data.access_token !== 'string' || !data.access_token) {
      return { ok: false, error: 'signup_missing_access_token' }
    }
    if (typeof data.user?.id !== 'string' || !data.user.id) {
      return { ok: false, error: 'signup_missing_user_id' }
    }
    const expiresIn =
      typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600
    return {
      ok: true,
      accessToken: data.access_token,
      expiresIn,
      userId: data.user.id,
      ...(typeof data.refresh_token === 'string' && data.refresh_token
        ? { refreshToken: data.refresh_token }
        : {})
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'signup_threw'
    }
  }
}

/** Worker 对无效 Supabase access 返回 401（invalid_token / missing_authorization）。 */
function isAuthInvalidExchangeFailure(status: number): boolean {
  return status === 401
}

function isAccessExpired(expiresAtIso: string, nowMs: number): boolean {
  const expiresMs = Date.parse(expiresAtIso)
  if (Number.isNaN(expiresMs)) {
    return true
  }
  return nowMs >= expiresMs - PENDING_ANON_ACCESS_CLOCK_SKEW_MS
}

function isWithinExchangeBackoff(
  pending: PendingAnonymousSession,
  nowMs: number,
  ignoreBackoff: boolean
): boolean {
  if (ignoreBackoff || !pending.lastExchangeAttemptAt) {
    return false
  }
  const lastMs = Date.parse(pending.lastExchangeAttemptAt)
  if (Number.isNaN(lastMs)) {
    return false
  }
  return nowMs - lastMs < PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS
}

function isWithin401Backoff(
  last401AtIso: string | undefined,
  nowMs: number,
  ignoreBackoff: boolean
): boolean {
  if (ignoreBackoff || !last401AtIso) {
    return false
  }
  const lastMs = Date.parse(last401AtIso)
  if (Number.isNaN(lastMs)) {
    return false
  }
  return nowMs - lastMs < ANON_EXCHANGE_401_BACKOFF_MS
}

async function touchPendingExchangeAttempt(pending: PendingAnonymousSession): Promise<void> {
  await setPendingAnonymousSession({
    ...pending,
    lastExchangeAttemptAt: new Date().toISOString()
  })
}

/**
 * access 过期时 refresh；成功写回轮换后的 token。
 * 无 refresh / refresh 失败 → 丢弃待交换会话并返回 null（调用方走全新 signup）。
 */
async function refreshPendingIfNeeded(
  pending: PendingAnonymousSession,
  nowMs: number
): Promise<PendingAnonymousSession | null> {
  if (!isAccessExpired(pending.expiresAt, nowMs)) {
    return pending
  }
  const refreshToken = pending.refreshToken?.trim()
  if (!refreshToken) {
    logger.info('Auth', '待交换会话已过期且无 refresh，丢弃后重新 signup', {
      userId: pending.userId,
      tokenSuffix: maskPendingAccessTokenForLog(pending.accessToken)
    })
    await clearPendingAnonymousSession()
    return null
  }

  // 复用 extension-oauth：接受任意 refresh_token，避免再写一套 GoTrue refresh
  const refreshed = await refreshAuthSessionDetailed(refreshToken)
  if (refreshed.status !== 'ok') {
    logger.info('Auth', '待交换会话 refresh 失败，丢弃后重新 signup', {
      userId: pending.userId,
      reason: refreshed.reason
    })
    await clearPendingAnonymousSession()
    return null
  }

  const expiresAt =
    refreshed.session.expiresAt != null
      ? new Date(refreshed.session.expiresAt * 1000).toISOString()
      : new Date(nowMs + 3600_000).toISOString()
  const next: PendingAnonymousSession = {
    accessToken: refreshed.session.accessToken,
    refreshToken: refreshed.session.refreshToken,
    userId: refreshed.session.userId,
    expiresAt,
    createdAt: pending.createdAt,
    ...(pending.lastExchangeAttemptAt
      ? { lastExchangeAttemptAt: pending.lastExchangeAttemptAt }
      : {})
  }
  await setPendingAnonymousSession(next)
  logger.info('Auth', '待交换会话已 refresh', {
    userId: next.userId,
    tokenSuffix: maskPendingAccessTokenForLog(next.accessToken)
  })
  return next
}

async function finishCreatedDeviceSession(
  deviceSession: DeviceSession,
  deps: EnsureAnonymousDeviceSessionDeps,
  startedAt: number
): Promise<EnsureAnonymousResult> {
  await setDeviceSession(deviceSession)
  await clearPendingAnonymousSession()
  await clearAnonExchange401Backoff()
  clearAnonymousCaptchaRetryNeeded()
  deps.onAfterDeviceStored?.()

  // 确认未误写旧键
  const leakedLegacy = await getAuthSession()
  if (leakedLegacy) {
    logger.error('Auth', '匿名 ensure 后发现误持久化的 auth_session（不应发生）', {
      userId: leakedLegacy.userId
    })
  }

  // AccountBinding + 本地库重归属 localProfileId → 匿名 userId
  const binding = await getAccountBinding()
  if (!binding) {
    const profile = await getOrCreateLocalProfile()
    try {
      await memoryItemRepository.remapOwnerId(profile.localProfileId, deviceSession.userId)
    } catch (error) {
      logger.warn('Auth', '匿名会话本地库重归属失败（仍写 binding）', error)
    }
    await setAccountBinding({
      accountId: deviceSession.userId,
      boundAt: new Date().toISOString()
    })
  }

  flowOk('Auth', 'ensure anonymous device session', startedAt, {
    userId: deviceSession.userId,
    deviceId: deviceSession.deviceId,
    tokenSuffix: maskDeviceTokenForLog(deviceSession.deviceToken)
  })
  return { status: 'created', session: deviceSession }
}

async function attemptExchange(
  pending: PendingAnonymousSession,
  deps: EnsureAnonymousDeviceSessionDeps,
  startedAt: number
): Promise<ExchangeAttemptOutcome> {
  deps.onBeforeExchange?.()
  const exchange = await registerDeviceViaSessionExchange(pending.accessToken)
  if (exchange.ok) {
    const deviceSession = deviceSessionFromRegisterData(exchange.data)
    return finishCreatedDeviceSession(deviceSession, deps, startedAt)
  }

  if (isAuthInvalidExchangeFailure(exchange.status)) {
    // AN2：401 保留 pending，写独立熔断键；禁止同次清 pending 再 signup 刷孤儿
    const backoff = await recordAnonExchange401()
    logger.info('Auth', '待交换会话 exchange 401，保留 pending 并进入熔断', {
      userId: pending.userId,
      status: exchange.status,
      error: exchange.error,
      last401At: backoff.last401At,
      count: backoff.count
    })
    return { kind: 'auth_invalid' }
  }

  await touchPendingExchangeAttempt(pending)
  markAnonymousCaptchaRetryNeeded()
  flowFail('Auth', 'ensure anonymous device session', startedAt, new Error(exchange.error), {
    failOpen: true,
    phase: 'exchange',
    status: exchange.status
  })
  return { kind: 'exchange_failed', error: exchange.error }
}

async function runFreshSignup(
  deps: EnsureAnonymousDeviceSessionDeps,
  startedAt: number
): Promise<EnsureAnonymousResult> {
  const captcha = await deps.getTurnstileToken()
  if (!captcha) {
    markAnonymousCaptchaRetryNeeded()
    flowOk('Auth', 'ensure anonymous device session', startedAt, {
      outcome: 'fail_open',
      reason: 'captcha_unavailable'
    })
    return { status: 'failed', error: 'captcha_unavailable' }
  }

  const signup = await signupAnonymousWithGoTrue(captcha)
  if (!signup.ok) {
    markAnonymousCaptchaRetryNeeded()
    flowFail('Auth', 'ensure anonymous device session', startedAt, new Error(signup.error), {
      failOpen: true
    })
    return { status: 'failed', error: signup.error }
  }

  const nowIso = new Date().toISOString()
  const pending: PendingAnonymousSession = {
    accessToken: signup.accessToken,
    userId: signup.userId,
    expiresAt: new Date(Date.now() + signup.expiresIn * 1000).toISOString(),
    createdAt: nowIso,
    ...(signup.refreshToken ? { refreshToken: signup.refreshToken } : {})
  }
  // exchange 之前立即持久化，失败可复用同一用户
  await setPendingAnonymousSession(pending)

  const outcome = await attemptExchange(pending, deps, startedAt)
  if ('kind' in outcome) {
    // 全新 signup 后仍 401：保留 pending + 熔断；fail-open，禁止同次再 signup
    if (outcome.kind === 'auth_invalid') {
      markAnonymousCaptchaRetryNeeded()
      flowFail(
        'Auth',
        'ensure anonymous device session',
        startedAt,
        new Error('exchange_auth_invalid_after_fresh_signup'),
        { failOpen: true, phase: 'exchange' }
      )
      return { status: 'failed', error: 'exchange_auth_invalid' }
    }
    return { status: 'failed', error: outcome.error }
  }
  return outcome
}

/**
 * 无设备会话时：复用待交换会话或 signup → exchange → 存 device → 清待交换 → binding + 重归属。
 * captcha null / 任一步失败 → fail-open（保持未登录）；exchange 网络失败保留待交换会话。
 * AN2：401 熔断窗口内不 signup / 不 exchange（`ignoreBackoff` 可绕过）。
 */
export async function ensureAnonymousDeviceSession(
  deps: EnsureAnonymousDeviceSessionDeps = { getTurnstileToken }
): Promise<EnsureAnonymousResult> {
  const ignoreBackoff = deps.ignoreBackoff === true
  const existing = await getDeviceSession()
  if (existing) {
    // 官网 Connect 等路径可能已写 device，残留 pending / 401 熔断 best-effort 清掉
    void clearPendingAnonymousSession().catch(() => undefined)
    void clearAnonExchange401Backoff().catch(() => undefined)
    return { status: 'already', session: existing }
  }
  const legacy = await getAuthSession()
  if (legacy) {
    // 有旧会话应走 migrate，不在此 signup
    return { status: 'skipped_has_legacy' }
  }

  const startedAt = flowStart('Auth', 'ensure anonymous device session')
  const nowMs = Date.now()

  // 401 熔断：读 pending 之前先判；窗口内零 signup / 零 exchange
  const exchange401Backoff = await getAnonExchange401Backoff()
  if (isWithin401Backoff(exchange401Backoff?.last401At, nowMs, ignoreBackoff)) {
    flowOk('Auth', 'ensure anonymous device session', startedAt, {
      outcome: 'fail_open',
      reason: 'exchange_401_backoff',
      last401At: exchange401Backoff?.last401At,
      count: exchange401Backoff?.count
    })
    return { status: 'failed', error: 'exchange_401_backoff' }
  }

  let pending = await getPendingAnonymousSession()
  if (pending) {
    if (isWithinExchangeBackoff(pending, nowMs, ignoreBackoff)) {
      flowOk('Auth', 'ensure anonymous device session', startedAt, {
        outcome: 'fail_open',
        reason: 'exchange_backoff',
        userId: pending.userId
      })
      return { status: 'failed', error: 'exchange_backoff' }
    }

    pending = await refreshPendingIfNeeded(pending, nowMs)
    if (pending) {
      const outcome = await attemptExchange(pending, deps, startedAt)
      if (!('kind' in outcome)) {
        return outcome
      }
      if (outcome.kind === 'exchange_failed') {
        return { status: 'failed', error: outcome.error }
      }
      // auth_invalid（401）：pending 保留 + 熔断已写 → fail-open，禁止同次全新 signup
      markAnonymousCaptchaRetryNeeded()
      flowFail(
        'Auth',
        'ensure anonymous device session',
        startedAt,
        new Error('exchange_auth_invalid'),
        { failOpen: true, phase: 'exchange' }
      )
      return { status: 'failed', error: 'exchange_auth_invalid' }
    }
  }

  return runFreshSignup(deps, startedAt)
}
