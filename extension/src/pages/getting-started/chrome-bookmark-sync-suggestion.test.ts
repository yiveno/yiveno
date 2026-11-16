import { describe, expect, it } from 'vitest'

import { shouldShowChromeBookmarkSyncSuggestion } from '@/pages/getting-started/chrome-bookmark-sync-suggestion'

describe('shouldShowChromeBookmarkSyncSuggestion', () => {
  it('仅 completed + sync 关 + 未 dismissal + ready/empty 时显示', () => {
    expect(
      shouldShowChromeBookmarkSyncSuggestion({
        importCompleted: true,
        syncEnabled: false,
        dismissed: false,
        libraryPhase: 'ready'
      })
    ).toBe(true)
    expect(
      shouldShowChromeBookmarkSyncSuggestion({
        importCompleted: true,
        syncEnabled: false,
        dismissed: false,
        libraryPhase: 'empty'
      })
    ).toBe(true)
  })

  it('导入未完成 / sync 已开 / 已 dismissal / importing 不显示', () => {
    expect(
      shouldShowChromeBookmarkSyncSuggestion({
        importCompleted: false,
        syncEnabled: false,
        dismissed: false,
        libraryPhase: 'ready'
      })
    ).toBe(false)
    expect(
      shouldShowChromeBookmarkSyncSuggestion({
        importCompleted: true,
        syncEnabled: true,
        dismissed: false,
        libraryPhase: 'ready'
      })
    ).toBe(false)
    expect(
      shouldShowChromeBookmarkSyncSuggestion({
        importCompleted: true,
        syncEnabled: false,
        dismissed: true,
        libraryPhase: 'ready'
      })
    ).toBe(false)
    expect(
      shouldShowChromeBookmarkSyncSuggestion({
        importCompleted: true,
        syncEnabled: false,
        dismissed: false,
        libraryPhase: 'importing'
      })
    ).toBe(false)
  })
})
