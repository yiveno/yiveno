/**
 * 待交换匿名会话读写（`yiveno:pending_anon_session`）。
 * 仅 ensure-anonymous 流程使用；非法形状 → null。
 */

import {
  PENDING_ANON_SESSION_STORAGE_KEY,
  PendingAnonymousSessionSchema,
  type PendingAnonymousSession
} from '@/core/identity/pending-anonymous-session'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取待交换匿名会话。 */
export async function getPendingAnonymousSession(): Promise<PendingAnonymousSession | null> {
  return readChromeStorageLocal(PENDING_ANON_SESSION_STORAGE_KEY, PendingAnonymousSessionSchema)
}

/** 写入待交换匿名会话。 */
export async function setPendingAnonymousSession(session: PendingAnonymousSession): Promise<void> {
  const parsed = PendingAnonymousSessionSchema.parse(session)
  await writeChromeStorageLocal(PENDING_ANON_SESSION_STORAGE_KEY, parsed)
}

/** 清除待交换匿名会话。 */
export async function clearPendingAnonymousSession(): Promise<void> {
  await removeChromeStorageLocal(PENDING_ANON_SESSION_STORAGE_KEY)
}
