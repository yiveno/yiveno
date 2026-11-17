import { beforeEach, describe, expect, it } from 'vitest'

import {
  tAccountSyncError,
  tChromeBookmarkImportError,
  tSettingsError
} from '@/infrastructure/i18n/background-error'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'

describe('background-error · 诚实归因映射', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      error_bookmark_import_read_failed: { message: 'read failed' },
      error_bookmark_import_write_failed: { message: 'write failed' },
      popup_import_failed_fallback: { message: 'import fallback' },
      settings_error_sync_incremental_offline: { message: 'sync offline' },
      settings_error_sync_incremental: { message: 'sync failed' },
      settings_ai_quota_failed_offline: { message: 'quota offline' },
      settings_ai_quota_failed_server: { message: 'quota server' },
      settings_ai_quota_sign_in: { message: 'quota sign in' }
    })
  })

  it('书签导入 READ/WRITE/FAILED 各有具体文案', () => {
    expect(tChromeBookmarkImportError('BOOKMARK_IMPORT_READ_FAILED')).toBe('read failed')
    expect(tChromeBookmarkImportError('BOOKMARK_IMPORT_WRITE_FAILED')).toBe('write failed')
    expect(tChromeBookmarkImportError('BOOKMARK_IMPORT_FAILED')).toBe('import fallback')
  })

  it('增量同步离线有独立文案', () => {
    expect(tAccountSyncError('SYNC_INCREMENTAL_OFFLINE')).toBe('sync offline')
    expect(tAccountSyncError('SYNC_INCREMENTAL_FAILED')).toBe('sync failed')
  })

  it('配额离线 / 服务端失败分流', () => {
    expect(tSettingsError('AI_HOSTED_QUOTA_OFFLINE')).toBe('quota offline')
    expect(tSettingsError('AI_HOSTED_QUOTA_FAILED')).toBe('quota server')
  })
})
