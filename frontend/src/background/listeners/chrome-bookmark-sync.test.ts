import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as syncService from '@/application/capture/chrome-bookmark-sync-service'
import {
  registerChromeBookmarkSyncListeners,
  resetChromeBookmarkSyncListenersForTests
} from '@/background/listeners/chrome-bookmark-sync'

describe('chrome-bookmark-sync listener', () => {
  beforeEach(() => {
    resetChromeBookmarkSyncListenersForTests()
    syncService.resetPendingChromeBookmarkSyncForTests()
    vi.stubGlobal('chrome', {
      bookmarks: {
        onCreated: { addListener: vi.fn() },
        onChanged: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
        onMoved: { addListener: vi.fn() }
      }
    })
  })

  it('registerChromeBookmarkSyncListeners 注册四个监听器', () => {
    registerChromeBookmarkSyncListeners()
    registerChromeBookmarkSyncListeners()

    expect(chrome.bookmarks.onCreated.addListener).toHaveBeenCalledTimes(1)
    expect(chrome.bookmarks.onChanged.addListener).toHaveBeenCalledTimes(1)
    expect(chrome.bookmarks.onRemoved.addListener).toHaveBeenCalledTimes(1)
    expect(chrome.bookmarks.onMoved.addListener).toHaveBeenCalledTimes(1)
  })

  it('onMoved 回调触发 handleChromeBookmarkChanged', async () => {
    const changedSpy = vi
      .spyOn(syncService, 'handleChromeBookmarkChanged')
      .mockResolvedValue(undefined)

    registerChromeBookmarkSyncListeners()

    const movedHandler = (chrome.bookmarks.onMoved.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (id: string, moveInfo: unknown) => void

    movedHandler('10', { parentId: '2', index: 0 })
    await Promise.resolve()

    expect(changedSpy).toHaveBeenCalledWith('10')
    changedSpy.mockRestore()
  })
})
