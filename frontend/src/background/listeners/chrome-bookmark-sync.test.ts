import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/background/bootstrap', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

import * as syncService from '@/application/capture/chrome-bookmark-sync-service'
import {
  areChromeBookmarkSyncListenersRegistered,
  registerChromeBookmarkSyncListeners,
  resetChromeBookmarkSyncListenersForTests,
  syncChromeBookmarkSyncListenersWithIngestSetting,
  unregisterChromeBookmarkSyncListeners
} from '@/background/listeners/chrome-bookmark-sync'
import * as actionBadge from '@/infrastructure/browser/action-badge'
import * as notifyTree from '@/infrastructure/messaging/notify-chrome-bookmark-tree-changed'

describe('chrome-bookmark-sync listener', () => {
  beforeEach(() => {
    resetChromeBookmarkSyncListenersForTests()
    syncService.resetPendingChromeBookmarkSyncForTests()
    vi.mocked(ensureBackgroundBootstrappedMock).mockClear()
    vi.stubGlobal('chrome', {
      bookmarks: {
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() }
      },
      action: {
        setBadgeText: vi.fn(async () => undefined),
        setBadgeBackgroundColor: vi.fn(async () => undefined)
      },
      runtime: {
        sendMessage: vi.fn(async () => undefined)
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
    expect(areChromeBookmarkSyncListenersRegistered()).toBe(true)
  })

  it('unregisterChromeBookmarkSyncListeners 卸下四个监听器', () => {
    registerChromeBookmarkSyncListeners()
    unregisterChromeBookmarkSyncListeners()
    unregisterChromeBookmarkSyncListeners()

    expect(chrome.bookmarks.onCreated.removeListener).toHaveBeenCalledTimes(1)
    expect(chrome.bookmarks.onChanged.removeListener).toHaveBeenCalledTimes(1)
    expect(chrome.bookmarks.onRemoved.removeListener).toHaveBeenCalledTimes(1)
    expect(chrome.bookmarks.onMoved.removeListener).toHaveBeenCalledTimes(1)
    expect(areChromeBookmarkSyncListenersRegistered()).toBe(false)
  })

  it('syncChromeBookmarkSyncListenersWithIngestSetting(false) 卸载监听', async () => {
    registerChromeBookmarkSyncListeners()
    await syncChromeBookmarkSyncListenersWithIngestSetting(false)
    expect(areChromeBookmarkSyncListenersRegistered()).toBe(false)
    expect(chrome.bookmarks.onCreated.removeListener).toHaveBeenCalled()
  })

  it('syncChromeBookmarkSyncListenersWithIngestSetting(true) 注册监听', async () => {
    await syncChromeBookmarkSyncListenersWithIngestSetting(true)
    expect(areChromeBookmarkSyncListenersRegistered()).toBe(true)
    expect(chrome.bookmarks.onCreated.addListener).toHaveBeenCalled()
  })

  it('onCreated 前先 await bootstrap', async () => {
    const createdSpy = vi
      .spyOn(syncService, 'handleChromeBookmarkCreated')
      .mockResolvedValue({ captured: false })
    vi.spyOn(notifyTree, 'notifyChromeBookmarkTreeChanged').mockImplementation(() => undefined)

    registerChromeBookmarkSyncListeners()

    const createdHandler = (chrome.bookmarks.onCreated.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void

    createdHandler('10', {
      id: '10',
      title: 'Retention',
      url: 'https://example.com'
    })

    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalledTimes(1)
      expect(createdSpy).toHaveBeenCalled()
    })
    createdSpy.mockRestore()
  })

  it('onCreated 捕获成功时闪 +1 角标', async () => {
    const createdSpy = vi
      .spyOn(syncService, 'handleChromeBookmarkCreated')
      .mockResolvedValue({ captured: true })
    const badgeSpy = vi.spyOn(actionBadge, 'flashActionBadge').mockResolvedValue(undefined)
    const notifySpy = vi
      .spyOn(notifyTree, 'notifyChromeBookmarkTreeChanged')
      .mockImplementation(() => undefined)

    registerChromeBookmarkSyncListeners()

    const createdHandler = (chrome.bookmarks.onCreated.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void

    createdHandler('10', {
      id: '10',
      title: 'Retention',
      url: 'https://example.com'
    })

    await vi.waitFor(() => {
      expect(createdSpy).toHaveBeenCalled()
      expect(badgeSpy).toHaveBeenCalledWith('success')
      expect(notifySpy).toHaveBeenCalled()
    })
    createdSpy.mockRestore()
    badgeSpy.mockRestore()
    notifySpy.mockRestore()
  })

  it('onChanged 后广播书签树变更（含目录改名）', async () => {
    const changedSpy = vi
      .spyOn(syncService, 'handleChromeBookmarkChanged')
      .mockResolvedValue(undefined)
    const notifySpy = vi
      .spyOn(notifyTree, 'notifyChromeBookmarkTreeChanged')
      .mockImplementation(() => undefined)

    registerChromeBookmarkSyncListeners()

    const changedHandler = (chrome.bookmarks.onChanged.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (id: string, changeInfo: { title?: string }) => void

    changedHandler('folder-1', { title: 'Leisure 1' })

    await vi.waitFor(() => {
      expect(changedSpy).toHaveBeenCalledWith('folder-1')
      expect(notifySpy).toHaveBeenCalled()
    })
    changedSpy.mockRestore()
    notifySpy.mockRestore()
  })

  it('onMoved 回调触发 handleChromeBookmarkChanged', async () => {
    const changedSpy = vi
      .spyOn(syncService, 'handleChromeBookmarkChanged')
      .mockResolvedValue(undefined)
    const notifySpy = vi
      .spyOn(notifyTree, 'notifyChromeBookmarkTreeChanged')
      .mockImplementation(() => undefined)

    registerChromeBookmarkSyncListeners()

    const movedHandler = (chrome.bookmarks.onMoved.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (id: string, moveInfo: unknown) => void

    movedHandler('10', { parentId: '2', index: 0 })

    await vi.waitFor(() => {
      expect(changedSpy).toHaveBeenCalledWith('10')
      expect(notifySpy).toHaveBeenCalled()
    })
    changedSpy.mockRestore()
    notifySpy.mockRestore()
  })
})
