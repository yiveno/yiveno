/**
 * 本机上次成功 handoff 的扩展 Auth `session_id`（chrome.storage.local）。
 * 用于 Connect 遇 409 时区分「本机孤儿租约可静默认领」vs「真·他端占租约须弹窗」。
 * 互斥仍看服务端 session；extensionId 不能区分 Profile。
 */

import { z } from 'zod'

import { logger } from '@/infrastructure/logging/logger'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

export const LAST_EXTENSION_LEASE_SESSION_KEY = 'yiveno:last_extension_lease_session_id' as const

const RecordSchema = z.object({
  sessionId: z.string().min(1)
})

/** 读本机上次 handoff 的 lease session_id。 */
export async function readLastExtensionLeaseSessionId(): Promise<string | null> {
  const row = await readChromeStorageLocal(LAST_EXTENSION_LEASE_SESSION_KEY, RecordSchema)
  const id = row?.sessionId?.trim()
  return id || null
}

/** handoff 成功后写入（覆盖旧值）。 */
export async function writeLastExtensionLeaseSessionId(sessionId: string): Promise<void> {
  const trimmed = sessionId.trim()
  if (!trimmed) {
    return
  }
  await writeChromeStorageLocal(LAST_EXTENSION_LEASE_SESSION_KEY, { sessionId: trimmed })
  logger.info('Auth', '已记录本机扩展 lease session_id', {
    sessionIdPreview: trimmed.slice(0, 8)
  })
}

/**
 * 远程租约已成功释放后清除。
 * 退登但 revoke 失败时**保留**，以便同机 Connect 静默认领。
 */
export async function clearLastExtensionLeaseSessionId(): Promise<void> {
  await removeChromeStorageLocal(LAST_EXTENSION_LEASE_SESSION_KEY)
}

/**
 * 409 租约是否可由本机静默认领：未登录且本地记录的 session_id 与租约一致。
 */
export async function isExtensionLeaseReclaimable(existingSessionId: string): Promise<boolean> {
  const expected = existingSessionId.trim()
  if (!expected) {
    return false
  }
  const local = await readLastExtensionLeaseSessionId()
  return local != null && local === expected
}
