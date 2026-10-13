import {
  mergeUserSettings,
  parseUserSettings,
  USER_SETTINGS_STORAGE_KEY,
  type UserSettings
} from '@/core/settings/user-settings'
import { writeChromeStorageLocal } from '@/infrastructure/storage/chrome-storage-local'

/** 读取用户设置；不存在或旧数据缺字段时用 parse 补默认。 */
export async function getUserSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(USER_SETTINGS_STORAGE_KEY)
  return parseUserSettings(result[USER_SETTINGS_STORAGE_KEY])
}

/** 局部更新用户设置。 */
export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings()
  const next = mergeUserSettings(current, patch)
  await writeChromeStorageLocal(USER_SETTINGS_STORAGE_KEY, next)
  return next
}

export { parseUserSettings, USER_SETTINGS_STORAGE_KEY }
