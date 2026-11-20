/**
 * 升级迁移：旧 `yiveno:auth_session` → `yiveno:device_session`（session_exchange）。
 * 铁律：先写新键成功再删旧键；失败 fail-open 保留旧会话。
 */

import type { DeviceSession } from '@/core/identity/device-session'
import {
  deviceSessionFromRegisterData,
  registerDeviceViaSessionExchange
} from '@/infrastructure/auth/device-register-api-client'
import { clearAuthValidationTimestamp } from '@/infrastructure/auth/auth-session-revalidate'
import { ensureAuthSessionLeaseAlarm } from '@/infrastructure/auth/auth-session-lease-alarm'
import { clearAuthSession, getAuthSession } from '@/infrastructure/identity/auth-session-service'
import {
  getDeviceSession,
  setDeviceSession
} from '@/infrastructure/identity/device-session-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

export type MigrateAuthToDeviceResult =
  | { status: 'already_device'; session: DeviceSession }
  | { status: 'migrated'; session: DeviceSession }
  | { status: 'no_legacy' }
  | { status: 'failed'; error: string }

/**
 * 若有旧 Supabase 会话且尚无 device 会话 → exchange → 先写后删。
 * 已有 device 或无旧键 → 不调用 Worker。
 */
export async function migrateAuthSessionToDeviceIfNeeded(): Promise<MigrateAuthToDeviceResult> {
  const existing = await getDeviceSession()
  if (existing) {
    return { status: 'already_device', session: existing }
  }

  const legacy = await getAuthSession()
  if (!legacy) {
    return { status: 'no_legacy' }
  }

  const startedAt = flowStart('Auth', 'migrate auth_session → device_session')
  const exchange = await registerDeviceViaSessionExchange(legacy.accessToken)
  if (!exchange.ok) {
    // fail-open：保留旧键，下次再试
    flowFail(
      'Auth',
      'migrate auth_session → device_session',
      startedAt,
      new Error(exchange.error),
      {
        failOpen: true,
        status: exchange.status
      }
    )
    logger.warn('Auth', 'session_exchange 失败，保留旧 auth_session', {
      error: exchange.error,
      status: exchange.status
    })
    return { status: 'failed', error: exchange.error }
  }

  const deviceSession = deviceSessionFromRegisterData(exchange.data)
  // 先写新键
  await setDeviceSession(deviceSession)
  // 再删旧键（写成功后才删）
  await clearAuthSession()
  await clearAuthValidationTimestamp()
  try {
    // device 会话无租约；关掉探测闹钟
    await ensureAuthSessionLeaseAlarm(false)
  } catch (error) {
    logger.warn('Auth', '迁移后关租约闹钟失败', error)
  }

  flowOk('Auth', 'migrate auth_session → device_session', startedAt, {
    userId: deviceSession.userId,
    deviceId: deviceSession.deviceId,
    isAnonymous: deviceSession.isAnonymous
  })
  return { status: 'migrated', session: deviceSession }
}
