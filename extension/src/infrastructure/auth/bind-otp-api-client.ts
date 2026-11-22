/**
 * Worker 绑定 OTP 客户端（仅 Background）。
 * `POST /api/auth/bind-code` · `bind-verify` · `claim-by-otp`；device Bearer。
 * 绝不 log 验证码 / claimToken / device token；邮箱仅掩码。
 */

import type { DeviceRegisterResponseData } from '@/infrastructure/auth/device-register-api-client'
import { getDeviceLabelAndPlatform } from '@/infrastructure/auth/device-label'
import { maskEmailForLog } from '@/infrastructure/auth/promote-anonymous-api-client'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

function readApiError(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return (body as { error: string }).error
  }
  return fallback
}

export type BindBranch = 'promote' | 'claim'

export type RequestBindCodeApiResult = { ok: true } | { ok: false; status: number; error: string }

export type VerifyBindCodeApiResult =
  | {
      ok: true
      data: { branch: BindBranch; claimToken: string }
    }
  | {
      ok: false
      status: number
      error: string
      remainingAttempts?: number
    }

export type ClaimByOtpApiResult =
  { ok: true; data: DeviceRegisterResponseData } | { ok: false; status: number; error: string }

/** POST /api/auth/bind-code */
export async function requestBindCodeApi(input: {
  deviceToken: string
  email: string
  turnstileToken: string
  locale: 'en' | 'zh'
}): Promise<RequestBindCodeApiResult> {
  const startedAt = flowStart('Auth', 'bind-code')
  try {
    const url = `${getApiBaseUrl()}/api/auth/bind-code`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.deviceToken}`
      },
      body: JSON.stringify({
        email: input.email,
        turnstileToken: input.turnstileToken,
        locale: input.locale
      })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error = readApiError(body, `http_${response.status}`)
      flowFail('Auth', 'bind-code', startedAt, new Error(error), {
        status: response.status,
        emailMasked: maskEmailForLog(input.email)
      })
      return { ok: false, status: response.status, error }
    }
    flowOk('Auth', 'bind-code', startedAt, {
      emailMasked: maskEmailForLog(input.email)
    })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bind_code_network'
    flowFail('Auth', 'bind-code', startedAt, error)
    return { ok: false, status: 0, error: message }
  }
}

/** POST /api/auth/bind-verify → `{ branch, claimToken }` */
export async function verifyBindCodeApi(input: {
  deviceToken: string
  email: string
  code: string
}): Promise<VerifyBindCodeApiResult> {
  const startedAt = flowStart('Auth', 'bind-verify')
  try {
    const url = `${getApiBaseUrl()}/api/auth/bind-verify`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.deviceToken}`
      },
      body: JSON.stringify({
        email: input.email,
        code: input.code
      })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error = readApiError(body, `http_${response.status}`)
      const remainingAttempts =
        typeof body === 'object' &&
        body !== null &&
        'remainingAttempts' in body &&
        typeof (body as { remainingAttempts: unknown }).remainingAttempts === 'number'
          ? (body as { remainingAttempts: number }).remainingAttempts
          : undefined
      flowFail('Auth', 'bind-verify', startedAt, new Error(error), {
        status: response.status,
        emailMasked: maskEmailForLog(input.email),
        ...(remainingAttempts !== undefined ? { remainingAttempts } : {})
      })
      return {
        ok: false,
        status: response.status,
        error,
        ...(remainingAttempts !== undefined ? { remainingAttempts } : {})
      }
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      (body as { success?: unknown }).success !== true ||
      typeof (body as { data?: unknown }).data !== 'object' ||
      (body as { data?: unknown }).data === null
    ) {
      flowFail('Auth', 'bind-verify', startedAt, new Error('invalid_bind_verify_response'))
      return { ok: false, status: 500, error: 'invalid_bind_verify_response' }
    }
    const data = (body as { data: { branch: unknown; claimToken: unknown } }).data
    if (
      (data.branch !== 'promote' && data.branch !== 'claim') ||
      typeof data.claimToken !== 'string' ||
      !data.claimToken
    ) {
      return { ok: false, status: 500, error: 'invalid_bind_verify_data' }
    }
    flowOk('Auth', 'bind-verify', startedAt, {
      emailMasked: maskEmailForLog(input.email),
      branch: data.branch
    })
    return {
      ok: true,
      data: { branch: data.branch, claimToken: data.claimToken }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bind_verify_network'
    flowFail('Auth', 'bind-verify', startedAt, error)
    return { ok: false, status: 0, error: message }
  }
}

/**
 * POST /api/auth/claim-by-otp
 * deviceLabel/platform 复用 AN6 helper；失败原样透传。
 */
export async function claimByOtpApi(input: {
  deviceToken: string
  claimToken: string
  deviceLabel?: string
  platform?: string
}): Promise<ClaimByOtpApiResult> {
  const startedAt = flowStart('Auth', 'claim-by-otp')
  try {
    const labels =
      input.deviceLabel !== undefined || input.platform !== undefined
        ? { deviceLabel: input.deviceLabel ?? '', platform: input.platform ?? '' }
        : getDeviceLabelAndPlatform()
    const url = `${getApiBaseUrl()}/api/auth/claim-by-otp`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.deviceToken}`
      },
      body: JSON.stringify({
        claimToken: input.claimToken,
        ...(labels.deviceLabel ? { deviceLabel: labels.deviceLabel } : {}),
        ...(labels.platform ? { platform: labels.platform } : {})
      })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error = readApiError(body, `http_${response.status}`)
      flowFail('Auth', 'claim-by-otp', startedAt, new Error(error), {
        status: response.status
      })
      return { ok: false, status: response.status, error }
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      (body as { success?: unknown }).success !== true ||
      typeof (body as { data?: unknown }).data !== 'object' ||
      (body as { data?: unknown }).data === null
    ) {
      flowFail('Auth', 'claim-by-otp', startedAt, new Error('invalid_claim_response'))
      return { ok: false, status: 500, error: 'invalid_claim_response' }
    }
    const data = (body as { data: DeviceRegisterResponseData }).data
    if (
      typeof data.deviceToken !== 'string' ||
      typeof data.deviceId !== 'string' ||
      typeof data.userId !== 'string' ||
      typeof data.isAnonymous !== 'boolean'
    ) {
      return { ok: false, status: 500, error: 'invalid_claim_data' }
    }
    flowOk('Auth', 'claim-by-otp', startedAt, {
      userId: data.userId,
      deviceId: data.deviceId
    })
    return { ok: true, data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'claim_network'
    flowFail('Auth', 'claim-by-otp', startedAt, error)
    return { ok: false, status: 0, error: message }
  }
}
