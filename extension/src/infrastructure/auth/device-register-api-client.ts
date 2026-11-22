/**
 * Worker 设备注册 / 本设备撤销 HTTP 客户端（仅 Background）。
 * mode=session_exchange：Bearer = 临时 Supabase access（迁移或匿名 signup 后）。
 */

import { maskDeviceTokenForLog, type DeviceSession } from '@/core/identity/device-session'
import { getDeviceLabelAndPlatform } from '@/infrastructure/auth/device-label'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

/** Worker `POST /api/auth/device-register` 成功 data。 */
export type DeviceRegisterResponseData = {
  deviceToken: string
  deviceId: string
  userId: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  isAnonymous: boolean
}

export type DeviceRegisterResult =
  { ok: true; data: DeviceRegisterResponseData } | { ok: false; status: number; error: string }

/**
 * POST /api/auth/device-register（session_exchange）。
 * 用临时 Supabase access 换 device token；不持久化 Supabase 会话。
 */
export async function registerDeviceViaSessionExchange(
  supabaseAccessToken: string
): Promise<DeviceRegisterResult> {
  const startedAt = flowStart('Auth', 'device-register session_exchange')
  try {
    const { deviceLabel, platform } = getDeviceLabelAndPlatform()
    const url = `${getApiBaseUrl()}/api/auth/device-register`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${supabaseAccessToken}`
      },
      body: JSON.stringify({
        mode: 'session_exchange',
        ...(deviceLabel ? { deviceLabel } : {}),
        ...(platform ? { platform } : {})
      })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `http_${response.status}`
      flowFail('Auth', 'device-register session_exchange', startedAt, new Error(error), {
        status: response.status
      })
      return { ok: false, status: response.status, error }
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      !('success' in body) ||
      (body as { success: unknown }).success !== true ||
      !('data' in body) ||
      typeof (body as { data: unknown }).data !== 'object' ||
      (body as { data: unknown }).data === null
    ) {
      flowFail(
        'Auth',
        'device-register session_exchange',
        startedAt,
        new Error('invalid_device_register_response')
      )
      return { ok: false, status: 500, error: 'invalid_device_register_response' }
    }
    const data = (body as { data: DeviceRegisterResponseData }).data
    if (
      typeof data.deviceToken !== 'string' ||
      typeof data.deviceId !== 'string' ||
      typeof data.userId !== 'string' ||
      typeof data.isAnonymous !== 'boolean'
    ) {
      return { ok: false, status: 500, error: 'invalid_device_register_data' }
    }
    flowOk('Auth', 'device-register session_exchange', startedAt, {
      userId: data.userId,
      deviceId: data.deviceId,
      isAnonymous: data.isAnonymous,
      tokenSuffix: maskDeviceTokenForLog(data.deviceToken)
    })
    return { ok: true, data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'device_register_threw'
    flowFail('Auth', 'device-register session_exchange', startedAt, error)
    return { ok: false, status: 0, error: message }
  }
}

/** 将 Worker 响应落成 DeviceSession（本机 createdAt）。 */
export function deviceSessionFromRegisterData(
  data: DeviceRegisterResponseData,
  createdAt: string = new Date().toISOString()
): DeviceSession {
  return {
    deviceToken: data.deviceToken,
    deviceId: data.deviceId,
    userId: data.userId,
    isAnonymous: data.isAnonymous,
    createdAt,
    ...(data.email ? { email: data.email } : {}),
    ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
    ...(data.displayName ? { displayName: data.displayName } : {})
  }
}

/**
 * POST /api/auth/device-revoke-self — 撤本设备 token。
 * 失败不抛；调用方尽力而为。
 */
export async function revokeOwnDeviceToken(deviceToken: string): Promise<boolean> {
  const startedAt = flowStart('Auth', 'device-revoke-self')
  try {
    const url = `${getApiBaseUrl()}/api/auth/device-revoke-self`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deviceToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    })
    if (!response.ok) {
      logger.warn('Auth', 'device-revoke-self 失败（不挡退出）', {
        status: response.status,
        tokenSuffix: maskDeviceTokenForLog(deviceToken)
      })
      flowFail('Auth', 'device-revoke-self', startedAt, new Error(`http_${response.status}`))
      return false
    }
    flowOk('Auth', 'device-revoke-self', startedAt, {
      tokenSuffix: maskDeviceTokenForLog(deviceToken)
    })
    return true
  } catch (error) {
    logger.warn('Auth', 'device-revoke-self 异常（不挡退出）', error)
    flowFail('Auth', 'device-revoke-self', startedAt, error)
    return false
  }
}
