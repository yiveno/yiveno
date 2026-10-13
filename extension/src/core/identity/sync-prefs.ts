import { z } from 'zod'

/**
 * 云同步偏好。
 * 默认 enabled=false：登录 ≠ 自动上传。
 */
export const SyncPrefsSchema = z.object({
  /** 是否开启云同步；缺省由 createDefaultSyncPrefs 补 false（登录 ≠ 自动上传） */
  enabled: z.boolean(),
  lastPulledAt: z.string().datetime().optional(),
  lastPushedAt: z.string().datetime().optional()
})

export type SyncPrefs = z.infer<typeof SyncPrefsSchema>

/** chrome.storage.local 键名。 */
export const SYNC_PREFS_STORAGE_KEY = 'yiveno:sync_prefs' as const

/** 默认同步偏好（不同步）。 */
export function createDefaultSyncPrefs(): SyncPrefs {
  return { enabled: false }
}
