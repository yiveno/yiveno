/**
 * 设备会话读写（`yiveno:device_session`）。
 * 与旧 `auth-session-service`（Supabase 会话）并存于迁移窗口；
 * 选用独立 service 而非改名：迁移期两套 schema 共存更清晰。
 */

import {
  DEVICE_SESSION_STORAGE_KEY,
  DeviceSessionSchema,
  type DeviceSession
} from '@/core/identity/device-session'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取持久化的设备会话。 */
export async function getDeviceSession(): Promise<DeviceSession | null> {
  return readChromeStorageLocal(DEVICE_SESSION_STORAGE_KEY, DeviceSessionSchema)
}

/** 写入设备会话。 */
export async function setDeviceSession(session: DeviceSession): Promise<void> {
  const parsed = DeviceSessionSchema.parse(session)
  await writeChromeStorageLocal(DEVICE_SESSION_STORAGE_KEY, parsed)
}

/** 清除设备会话。 */
export async function clearDeviceSession(): Promise<void> {
  await removeChromeStorageLocal(DEVICE_SESSION_STORAGE_KEY)
}
