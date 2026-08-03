import { z } from 'zod'

/**
 * 云同步偏好。
 * 默认 enabled=false：登录 ≠ 自动上传。
 */
export const SyncPrefsSchema = z.object({
  enabled: z.boolean().default(false),
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
