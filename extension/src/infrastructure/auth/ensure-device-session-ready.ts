/**
 * SW 启动 / GET_AUTH_STATE：确保设备会话就绪。
 * 顺序：已有 device → 跳过；有旧 auth → migrate；皆无 → ensure anonymous（fail-open）。
 */

import type { DeviceSession } from '@/core/identity/device-session'
import { ensureAnonymousDeviceSession } from '@/infrastructure/auth/ensure-anonymous-device-session'
import { migrateAuthSessionToDeviceIfNeeded } from '@/infrastructure/auth/migrate-auth-to-device-session'
import { getDeviceSession } from '@/infrastructure/identity/device-session-service'
import { logger } from '@/infrastructure/logging/logger'

export type EnsureDeviceSessionReadyResult = {
  device: DeviceSession | null
  /** 迁移或匿名流程的备注（日志用） */
  note: string
}

let ensureInflight: Promise<EnsureDeviceSessionReadyResult> | null = null

async function runEnsureDeviceSessionReady(): Promise<EnsureDeviceSessionReadyResult> {
  const existing = await getDeviceSession()
  if (existing) {
    return { device: existing, note: 'already_device' }
  }

  const migrated = await migrateAuthSessionToDeviceIfNeeded()
  if (migrated.status === 'migrated' || migrated.status === 'already_device') {
    return { device: migrated.session, note: migrated.status }
  }
  if (migrated.status === 'failed') {
    // 旧会话仍在；调用方走 legacy 路径
    return { device: null, note: `migrate_failed:${migrated.error}` }
  }

  // 无旧键 → 匿名 ensure（fail-open）
  const anon = await ensureAnonymousDeviceSession()
  if (anon.status === 'created' || anon.status === 'already') {
    return { device: anon.session, note: anon.status }
  }
  if (anon.status === 'skipped_has_legacy') {
    return { device: null, note: 'skipped_has_legacy' }
  }
  logger.info('Auth', 'ensure device session：匿名 fail-open', { error: anon.error })
  return { device: null, note: `anon_failed:${anon.error}` }
}

/**
 * 幂等 + single-flight：并发启动 / GET_AUTH_STATE 共用一次 ensure。
 */
export async function ensureDeviceSessionReady(): Promise<EnsureDeviceSessionReadyResult> {
  if (ensureInflight) {
    return ensureInflight
  }
  ensureInflight = runEnsureDeviceSessionReady().finally(() => {
    ensureInflight = null
  })
  return ensureInflight
}

/** 测试用：清 single-flight。 */
export function resetEnsureDeviceSessionReadyForTests(): void {
  ensureInflight = null
}
