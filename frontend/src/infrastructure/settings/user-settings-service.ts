import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  parseUserSettings,
  USER_SETTINGS_STORAGE_KEY,
  UserSettingsSchema,
  type UserSettings
} from '@/core/settings/user-settings'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取用户设置；不存在时返回默认值。 */
export async function getUserSettings(): Promise<UserSettings> {
  const stored = await readChromeStorageLocal(USER_SETTINGS_STORAGE_KEY, UserSettingsSchema)
  return stored ?? { ...DEFAULT_USER_SETTINGS }
}

/** 局部更新用户设置。 */
export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings()
  const next = mergeUserSettings(current, patch)
  await writeChromeStorageLocal(USER_SETTINGS_STORAGE_KEY, next)
  return next
}

export { parseUserSettings, USER_SETTINGS_STORAGE_KEY, DEFAULT_USER_SETTINGS }
