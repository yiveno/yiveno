/**
 * 匿名设备会话：GoTrue signup → session_exchange → 只存 device token。
 * 铁律（W1' N3）：exchange 完成前不得发起 AI；瞬态 Supabase 会话仅内存，不落盘。
 */

import type { DeviceSession } from '@/core/identity/device-session'
import { maskDeviceTokenForLog } from '@/core/identity/device-session'
import { getSupabasePublicConfig } from '@/infrastructure/auth/supabase-client'
import {
  deviceSessionFromRegisterData,
  registerDeviceViaSessionExchange
} from '@/infrastructure/auth/device-register-api-client'
import {
  clearAnonymousCaptchaRetryNeeded,
  getTurnstileToken,
  markAnonymousCaptchaRetryNeeded
} from '@/infrastructure/auth/turnstile-token-provider'
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
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

export type EnsureAnonymousDeviceSessionDeps = {
  getTurnstileToken: () => Promise<string | null>
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
  user?: { id?: string; is_anonymous?: boolean }
}

/**
 * 裸 fetch GoTrue 匿名 signup（captcha 在 gotrue_meta_security 内）。
 * 成功仅返回内存 access_token；调用方不得写入 chrome.storage。
 */
export async function signupAnonymousWithGoTrue(
  captchaToken: string
): Promise<{ ok: true; accessToken: string; userId?: string } | { ok: false; error: string }> {
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
    return {
      ok: true,
      accessToken: data.access_token,
      ...(typeof data.user?.id === 'string' ? { userId: data.user.id } : {})
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'signup_threw'
    }
  }
}

/**
 * 无任何会话时：signup → exchange → 存 device → 丢弃 Supabase → binding + 本地库重归属。
 * captcha null / 任一步失败 → fail-open（保持未登录）。
 */
export async function ensureAnonymousDeviceSession(
  deps: EnsureAnonymousDeviceSessionDeps = { getTurnstileToken }
): Promise<EnsureAnonymousResult> {
  const existing = await getDeviceSession()
  if (existing) {
    return { status: 'already', session: existing }
  }
  const legacy = await getAuthSession()
  if (legacy) {
    // 有旧会话应走 migrate，不在此 signup
    return { status: 'skipped_has_legacy' }
  }

  const startedAt = flowStart('Auth', 'ensure anonymous device session')
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

  // 内存持有；exchange 前可观测钩（测 exchange-before-AI）
  deps.onBeforeExchange?.()
  const exchange = await registerDeviceViaSessionExchange(signup.accessToken)
  // 立刻丢弃内存中的 Supabase access（不写 storage）
  const discardedAccess = signup.accessToken
  void discardedAccess

  if (!exchange.ok) {
    markAnonymousCaptchaRetryNeeded()
    flowFail('Auth', 'ensure anonymous device session', startedAt, new Error(exchange.error), {
      failOpen: true,
      phase: 'exchange'
    })
    return { status: 'failed', error: exchange.error }
  }

  const deviceSession = deviceSessionFromRegisterData(exchange.data)
  await setDeviceSession(deviceSession)
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
