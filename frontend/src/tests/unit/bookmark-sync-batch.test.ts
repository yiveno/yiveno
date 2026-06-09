import { describe, it, expect, beforeEach, vi } from 'vitest'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'
import {
  BOOKMARK_SYNC_BATCH_SESSION_KEY,
  isBookmarkSyncBatchSuspended,
  setBookmarkSyncBatchSuspended
} from '@/core/bookmark/bookmark-sync-batch'

describe('bookmark-sync-batch', () => {
  const sessionStore = new Map<string, unknown>()

  beforeEach(() => {
    sessionStore.clear()
    vi.spyOn(chromeStorage, 'setSession').mockImplementation(async (key, value) => {
      sessionStore.set(key, value)
    })
    vi.spyOn(chromeStorage, 'getSession').mockImplementation(async (key, defaultValue) => {
      return (sessionStore.get(key) as boolean | undefined) ?? defaultValue
    })
  })

  it('默认不暂停自动同步', async () => {
    expect(await isBookmarkSyncBatchSuspended()).toBe(false)
  })

  it('可设置并读取批量应用暂停状态', async () => {
    await setBookmarkSyncBatchSuspended(true)
    expect(await isBookmarkSyncBatchSuspended()).toBe(true)
    expect(sessionStore.get(BOOKMARK_SYNC_BATCH_SESSION_KEY)).toBe(true)

    await setBookmarkSyncBatchSuspended(false)
    expect(await isBookmarkSyncBatchSuspended()).toBe(false)
  })
})
