/**
 * 设备会话存活校验：轻量 GET /api/account/subscription（双栈已接）。
 * 401 → invalid；其它错误 → uncertain（不断登录）。无 refresh、无租约。
 */

import type { DeviceSession } from '@/core/identity/device-session'
import { maskDeviceTokenForLog } from '@/core/identity/device-session'
import {
  markAuthValidatedNow,
  shouldRevalidateAuthSession
} from '@/infrastructure/auth/auth-session-revalidate'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

export type DeviceRevalidateResult =
  | { status: 'skipped' }
  | { status: 'valid'; session: DeviceSession }
  | { status: 'invalid'; reason: string }
  | { status: 'uncertain'; reason: string }

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

let deviceRevalidateInflight: {
  deviceToken: string
  promise: Promise<DeviceRevalidateResult>
} | null = null

async function probeDeviceSessionAlive(deviceToken: string): Promise<{
  kind: 'alive' | 'invalid' | 'uncertain'
  reason: string
}> {
  try {
    const url = `${getApiBaseUrl()}/api/account/subscription`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${deviceToken}`,
        'content-type': 'application/json'
      }
    })
    if (response.status === 401) {
      return { kind: 'invalid', reason: 'device_token_unauthorized' }
    }
    if (!response.ok) {
      return { kind: 'uncertain', reason: `http_${response.status}` }
    }
    return { kind: 'alive', reason: 'ok' }
  } catch (error) {
    return {
      kind: 'uncertain',
      reason: error instanceof Error ? error.message : 'device_probe_threw'
    }
  }
}

async function runRevalidateDeviceSession(session: DeviceSession): Promise<DeviceRevalidateResult> {
  const startedAt = flowStart('Auth', 'revalidate device session')
  const probe = await probeDeviceSessionAlive(session.deviceToken)
  if (probe.kind === 'alive') {
    await markAuthValidatedNow()
    flowOk('Auth', 'revalidate device session', startedAt, {
      userId: session.userId,
      deviceId: session.deviceId,
      tokenSuffix: maskDeviceTokenForLog(session.deviceToken)
    })
    return { status: 'valid', session }
  }
  if (probe.kind === 'invalid') {
    await markAuthValidatedNow()
    flowFail('Auth', 'revalidate device session', startedAt, new Error(probe.reason), {
      outcome: 'invalid',
      deviceId: session.deviceId
    })
    return { status: 'invalid', reason: probe.reason }
  }
  logger.warn('Auth', 'revalidate device session：瞬时失败，保留登录态', {
    reason: probe.reason,
    deviceId: session.deviceId
  })
  flowFail('Auth', 'revalidate device session', startedAt, new Error(probe.reason), {
    outcome: 'uncertain'
  })
  return { status: 'uncertain', reason: probe.reason }
}

/**
 * 节流后探测 device token 是否仍有效。
 * 与旧 Supabase revalidate 共用 AUTH_LAST_VALIDATED_AT 节流键。
 */
export async function revalidateDeviceSession(
  session: DeviceSession,
  options: { force?: boolean } = {}
): Promise<DeviceRevalidateResult> {
  if (!options.force && !(await shouldRevalidateAuthSession())) {
    return { status: 'skipped' }
  }

  const token = session.deviceToken
  if (deviceRevalidateInflight && deviceRevalidateInflight.deviceToken === token) {
    return deviceRevalidateInflight.promise
  }

  const promise = runRevalidateDeviceSession(session).finally(() => {
    if (deviceRevalidateInflight?.promise === promise) {
      deviceRevalidateInflight = null
    }
  })
  deviceRevalidateInflight = { deviceToken: token, promise }
  return promise
}
