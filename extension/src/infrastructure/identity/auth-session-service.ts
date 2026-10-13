import {
  AUTH_SESSION_STORAGE_KEY,
  AuthSessionSchema,
  type AuthSession
} from '@/core/identity/auth-session'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取持久化的 Auth 会话。 */
export async function getAuthSession(): Promise<AuthSession | null> {
  return readChromeStorageLocal(AUTH_SESSION_STORAGE_KEY, AuthSessionSchema)
}

/** 写入 Auth 会话。 */
export async function setAuthSession(session: AuthSession): Promise<void> {
  const parsed = AuthSessionSchema.parse(session)
  await writeChromeStorageLocal(AUTH_SESSION_STORAGE_KEY, parsed)
}

/** 清除 Auth 会话。 */
export async function clearAuthSession(): Promise<void> {
  await removeChromeStorageLocal(AUTH_SESSION_STORAGE_KEY)
}
