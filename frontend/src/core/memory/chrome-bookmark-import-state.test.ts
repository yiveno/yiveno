import { describe, expect, it } from 'vitest'

import {
  getChromeBookmarkImportPercent,
  type ChromeBookmarkImportState
} from '@/core/memory/chrome-bookmark-import-state'

describe('chrome-bookmark-import-state', () => {
  it('getChromeBookmarkImportPercent 按 imported/total 计算', () => {
    const state: ChromeBookmarkImportState = {
      status: 'running',
      importedCount: 250,
      totalCount: 1000
    }
    expect(getChromeBookmarkImportPercent(state)).toBe(25)
  })

  it('completed 返回 100', () => {
    const state: ChromeBookmarkImportState = {
      status: 'completed',
      importedCount: 100,
      totalCount: 100
    }
    expect(getChromeBookmarkImportPercent(state)).toBe(100)
  })
})
