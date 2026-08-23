import { z } from 'zod'

/**
 * 隐私说明确认水位。
 * 说明文案重大变更时递增 PRIVACY_NOTICE_VERSION，迫使重新确认后再开同步。
 */
export const PRIVACY_NOTICE_VERSION = 2 as const

/** chrome.storage.local 键。 */
export const PRIVACY_PREFS_STORAGE_KEY = 'yiveno:privacy_prefs' as const

export const PrivacyPrefsSchema = z.object({
  /** 已确认的隐私说明版本；未确认则为 undefined */
  noticeAckedVersion: z.number().int().positive().optional(),
  /** 确认时间 ISO */
  noticeAckedAt: z.string().datetime().optional()
})

export type PrivacyPrefs = z.infer<typeof PrivacyPrefsSchema>

/** 默认：未确认。 */
export function createDefaultPrivacyPrefs(): PrivacyPrefs {
  return {}
}

/** 是否已确认当前说明版本。 */
export function hasAckedCurrentPrivacyNotice(prefs: PrivacyPrefs): boolean {
  return prefs.noticeAckedVersion === PRIVACY_NOTICE_VERSION
}
