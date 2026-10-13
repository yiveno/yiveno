import { describe, expect, it } from 'vitest'

import {
  PRIVACY_NOTICE_VERSION,
  createDefaultPrivacyPrefs,
  hasAckedCurrentPrivacyNotice
} from '@/core/identity/privacy-prefs'

describe('hasAckedCurrentPrivacyNotice', () => {
  it('默认未确认', () => {
    expect(hasAckedCurrentPrivacyNotice(createDefaultPrivacyPrefs())).toBe(false)
  })

  it('版本匹配才算已确认', () => {
    expect(
      hasAckedCurrentPrivacyNotice({
        noticeAckedVersion: PRIVACY_NOTICE_VERSION,
        noticeAckedAt: '2026-08-05T00:00:00.000Z'
      })
    ).toBe(true)
    expect(
      hasAckedCurrentPrivacyNotice({
        noticeAckedVersion: PRIVACY_NOTICE_VERSION + 1,
        noticeAckedAt: '2026-08-05T00:00:00.000Z'
      })
    ).toBe(false)
  })
})
