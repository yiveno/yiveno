/**
 * 隐私偏好读写（chrome.storage.local）。
 */

import {
  createDefaultPrivacyPrefs,
  PRIVACY_NOTICE_VERSION,
  PRIVACY_PREFS_STORAGE_KEY,
  PrivacyPrefsSchema,
  type PrivacyPrefs
} from '@/core/identity/privacy-prefs'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取隐私偏好。 */
export async function getPrivacyPrefs(): Promise<PrivacyPrefs> {
  const existing = await readChromeStorageLocal(PRIVACY_PREFS_STORAGE_KEY, PrivacyPrefsSchema)
  return existing ?? createDefaultPrivacyPrefs()
}

/** 确认当前版本隐私说明。 */
export async function ackCurrentPrivacyNotice(): Promise<PrivacyPrefs> {
  const next: PrivacyPrefs = {
    noticeAckedVersion: PRIVACY_NOTICE_VERSION,
    noticeAckedAt: new Date().toISOString()
  }
  const parsed = PrivacyPrefsSchema.parse(next)
  await writeChromeStorageLocal(PRIVACY_PREFS_STORAGE_KEY, parsed)
  return parsed
}

/** 删除账号后重置隐私确认（下次开同步需重新 ack）。 */
export async function clearPrivacyPrefs(): Promise<void> {
  await removeChromeStorageLocal(PRIVACY_PREFS_STORAGE_KEY)
}
