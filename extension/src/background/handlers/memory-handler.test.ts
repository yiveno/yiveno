import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { DEFAULT_USER_SETTINGS, USER_SETTINGS_STORAGE_KEY } from '@/core/settings/user-settings'
import {
  handleCaptureBookmark,
  handleCaptureTextExcerpt,
  handleDeleteMemoryItem,
  handleGetMemoryItem,
  handleListMemoryItems,
  handleRecordRecallDismiss,
  handleUpdateMemoryNote
} from '@/background/handlers/memory-handler'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { EXCERPT_CAPTURE_COUNT_LOCAL_KEY } from '@/infrastructure/storage/first-recall-onboarding-storage'
import { MEMORY_LIBRARY_REVISION_LOCAL_KEY } from '@/infrastructure/storage/memory-library-revision-storage'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }

  return {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === 'string') {
            return { [keys]: store[keys] }
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map(key => [key, store[key]]))
          }
          return { ...store, ...keys }
        }),
        set: vi.fn(async (items: StorageMap) => {
          Object.assign(store, items)
        }),
        remove: vi.fn(async () => undefined)
      }
    },
    tabs: {
      query: vi.fn(async () => [
        {
          title: 'Example Page',
          url: 'https://example.com/article',
          favIconUrl: 'https://example.com/favicon.ico'
        }
      ])
    },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setBadgeBackgroundColor: vi.fn(async () => undefined)
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('memory-handler', () => {
  beforeEach(async () => {
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [USER_SETTINGS_STORAGE_KEY]: {
          ...DEFAULT_USER_SETTINGS,
          chromeBookmarkIngestEnabled: true
        }
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('handleCaptureBookmark 写入并返回 MemoryItem', async () => {
    const alignmentCache = await import('@/application/memory/bookmark-sync-alignment-cache')
    const invalidateSpy = vi.spyOn(alignmentCache, 'invalidateBookmarkSyncAlignmentCache')

    const response = await handleCaptureBookmark({
      title: 'Yiveno',
      url: 'https://yiveno.com'
    })

    expect(response.ok).toBe(true)
    if (!response.ok || !('item' in response)) {
      return
    }

    expect(response.item.type).toBe('bookmark')
    if (response.item.type !== 'bookmark') {
      return
    }
    expect(response.item.payload.title).toBe('Yiveno')
    expect(invalidateSpy).toHaveBeenCalledOnce()
    invalidateSpy.mockRestore()
  })

  it('handleListMemoryItems 返回当前用户条目', async () => {
    await handleCaptureBookmark({
      title: 'First',
      url: 'https://first.example.com'
    })

    const response = await handleListMemoryItems({ limit: 10 })
    expect(response.ok).toBe(true)
    if (!response.ok || !('items' in response)) {
      return
    }

    expect(response.total).toBe(1)
    expect(response.items[0]?.payload).toMatchObject({ title: 'First' })
  })

  it('handleListMemoryItems 的 total 是活条目全量计数而非 items.length', async () => {
    for (let index = 0; index < 3; index += 1) {
      const captured = await handleCaptureTextExcerpt({
        selectedText: `list total excerpt ${index}`,
        sourceUrl: `https://list-total.example.com/${index}`,
        pageTitle: `T${index}`
      })
      expect(captured.ok).toBe(true)
    }

    const response = await handleListMemoryItems({ type: 'text_excerpt', limit: 2 })
    expect(response.ok).toBe(true)
    if (!response.ok || !('items' in response)) {
      return
    }
    expect(response.items).toHaveLength(2)
    expect(response.total).toBe(3)
    expect(response.total).not.toBe(response.items.length)
  })

  it('handleCaptureBookmark 拒绝非法 payload', async () => {
    const response = await handleCaptureBookmark({ title: '', url: 'not-a-url' })
    expect(response.ok).toBe(false)
  })

  it('handleCaptureTextExcerpt 可写入 clues.note', async () => {
    const response = await handleCaptureTextExcerpt({
      selectedText: 'Clouds stack over distant mountains',
      sourceUrl: 'https://www.gushiwen.cn/shiwenv_demo.aspx',
      pageTitle: 'A quiet line',
      note: 'want to revisit this'
    })
    expect(response.ok).toBe(true)
    if (!response.ok || !('item' in response)) {
      return
    }
    expect(response.item.type).toBe('text_excerpt')
    expect(response.item.clues.note).toBe('want to revisit this')
  })

  it('handleCaptureTextExcerpt 重复响应带 duplicate 且不闪 success badge', async () => {
    const payload = {
      selectedText: 'duplicate capture excerpt for badge skip',
      sourceUrl: 'https://example.com/dup-capture',
      pageTitle: 'Dup'
    }
    const first = await handleCaptureTextExcerpt(payload)
    expect(first.ok).toBe(true)
    expect(chrome.action.setBadgeText).toHaveBeenCalled()
    // 首次写入会异步 bump 计数/修订；等微任务落地后再清 mock
    await vi.waitFor(() => {
      const bumpCalls = vi.mocked(chrome.storage.local.set).mock.calls.filter(([items]) => {
        const record = items as Record<string, unknown>
        return (
          EXCERPT_CAPTURE_COUNT_LOCAL_KEY in record || MEMORY_LIBRARY_REVISION_LOCAL_KEY in record
        )
      })
      expect(bumpCalls.length).toBeGreaterThan(0)
    })
    vi.mocked(chrome.action.setBadgeText).mockClear()
    vi.mocked(chrome.action.setBadgeBackgroundColor).mockClear()
    vi.mocked(chrome.storage.local.set).mockClear()

    const second = await handleCaptureTextExcerpt(payload)
    expect(second.ok).toBe(true)
    if (!second.ok || !('item' in second)) {
      return
    }
    expect(second.duplicate).toBe(true)
    if (first.ok && 'item' in first) {
      expect(second.item.id).toBe(first.item.id)
    }
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled()
    // 重复路径不 bump 摘录计数 / 库修订信号
    await new Promise<void>(resolve => {
      queueMicrotask(() => resolve())
    })
    const bumpOnDuplicate = vi.mocked(chrome.storage.local.set).mock.calls.filter(([items]) => {
      const record = items as Record<string, unknown>
      return (
        EXCERPT_CAPTURE_COUNT_LOCAL_KEY in record || MEMORY_LIBRARY_REVISION_LOCAL_KEY in record
      )
    })
    expect(bumpOnDuplicate).toHaveLength(0)
  })

  it('handleUpdateMemoryNote 可为书签事后补注', async () => {
    const captured = await handleCaptureBookmark({
      title: 'Retention analysis',
      url: 'https://example.com/retention'
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok || !('item' in captured)) {
      return
    }

    const updated = await handleUpdateMemoryNote({
      id: captured.item.id,
      note: 'plan for the leadership review'
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok || !('item' in updated)) {
      return
    }
    expect(updated.item.clues.note).toBe('plan for the leadership review')

    const cleared = await handleUpdateMemoryNote({
      id: captured.item.id,
      note: ''
    })
    expect(cleared.ok).toBe(true)
    if (!cleared.ok || !('item' in cleared)) {
      return
    }
    expect(cleared.item.clues.note).toBeUndefined()
  })

  it('handleDeleteMemoryItem 可软删摘录', async () => {
    const captured = await handleCaptureTextExcerpt({
      selectedText: 'deletable excerpt',
      sourceUrl: 'https://example.com/note',
      pageTitle: 'Note'
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok || !('item' in captured)) {
      return
    }

    const deleted = await handleDeleteMemoryItem({ id: captured.item.id })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok || !('item' in deleted)) {
      return
    }
    expect(deleted.item.deletedAt).toBeTruthy()

    const listed = await handleListMemoryItems({ type: 'text_excerpt', limit: 10 })
    expect(listed.ok).toBe(true)
    if (!listed.ok || !('items' in listed)) {
      return
    }
    expect(listed.items).toHaveLength(0)

    const fetched = await handleGetMemoryItem({ id: captured.item.id })
    expect(fetched.ok).toBe(false)
  })

  it('handleDeleteMemoryItem 允许删书签并写墓碑、失效缓存', async () => {
    const alignmentCache = await import('@/application/memory/bookmark-sync-alignment-cache')
    const importHandler = await import('@/background/handlers/import-handler')
    const alignmentSpy = vi.spyOn(alignmentCache, 'invalidateBookmarkSyncAlignmentCache')
    const treeSpy = vi.spyOn(importHandler, 'invalidateBookmarkLibraryTreeOnChromeChange')

    const { memoryItemService } = await import('@/application/memory/memory-item-service')
    const item = await memoryItemService.upsertBookmarkFromChrome({
      payload: {
        title: 'Keep in Chrome',
        url: 'https://bookmark.example.com',
        chromeBookmarkId: 'chrome-del-1'
      },
      captureEntry: 'sync'
    })

    const deleted = await handleDeleteMemoryItem({ id: item.id })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok || !('item' in deleted)) {
      return
    }
    expect(deleted.item.deletedAt).toBeTruthy()

    const { readChromeBookmarkDeleteTombstoneIds } =
      await import('@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage')
    expect((await readChromeBookmarkDeleteTombstoneIds()).has('chrome-del-1')).toBe(true)
    expect(alignmentSpy).toHaveBeenCalled()
    expect(treeSpy).toHaveBeenCalled()
  })

  it('handleDeleteMemoryItem 墓碑写失败时条目未软删', async () => {
    const tombstoneStorage =
      await import('@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage')
    const addSpy = vi
      .spyOn(tombstoneStorage, 'addChromeBookmarkDeleteTombstone')
      .mockRejectedValueOnce(new Error('storage full'))

    const { memoryItemService } = await import('@/application/memory/memory-item-service')
    const item = await memoryItemService.upsertBookmarkFromChrome({
      payload: {
        title: 'Tomb fail',
        url: 'https://bookmark.example.com/tomb-fail',
        chromeBookmarkId: 'chrome-tomb-fail-1'
      },
      captureEntry: 'sync'
    })

    const deleted = await handleDeleteMemoryItem({ id: item.id })
    expect(deleted.ok).toBe(false)
    expect(addSpy).toHaveBeenCalledWith('chrome-tomb-fail-1')

    const fetched = await handleGetMemoryItem({ id: item.id })
    expect(fetched.ok).toBe(true)
    if (!fetched.ok || !('item' in fetched)) {
      return
    }
    expect(fetched.item.deletedAt).toBeNull()
    addSpy.mockRestore()
  })

  it('handleDeleteMemoryItem 书签：先写墓碑再软删', async () => {
    const tombstoneStorage =
      await import('@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage')
    const { memoryItemService } = await import('@/application/memory/memory-item-service')
    const callOrder: string[] = []
    const realAdd = tombstoneStorage.addChromeBookmarkDeleteTombstone
    const wrapAdd = vi
      .spyOn(tombstoneStorage, 'addChromeBookmarkDeleteTombstone')
      .mockImplementation(async chromeBookmarkId => {
        callOrder.push('tombstone')
        await realAdd(chromeBookmarkId)
      })
    const realSoft = memoryItemService.softDelete.bind(memoryItemService)
    const wrapSoft = vi.spyOn(memoryItemService, 'softDelete').mockImplementation(async id => {
      callOrder.push('softDelete')
      return realSoft(id)
    })

    const item = await memoryItemService.upsertBookmarkFromChrome({
      payload: {
        title: 'Order check',
        url: 'https://bookmark.example.com/order',
        chromeBookmarkId: 'chrome-order-1'
      },
      captureEntry: 'sync'
    })

    const deleted = await handleDeleteMemoryItem({ id: item.id })
    expect(deleted.ok).toBe(true)
    expect(callOrder).toEqual(['tombstone', 'softDelete'])
    expect(
      (await tombstoneStorage.readChromeBookmarkDeleteTombstoneIds()).has('chrome-order-1')
    ).toBe(true)
    wrapAdd.mockRestore()
    wrapSoft.mockRestore()
  })

  it('handleRecordRecallDismiss 写回 dismissCount', async () => {
    const captured = await handleCaptureBookmark({
      title: 'dismissible bookmark',
      url: 'https://dismiss-handler.example.com'
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok || !('item' in captured)) {
      return
    }

    const response = await handleRecordRecallDismiss({ ids: [captured.item.id] })
    expect(response.ok).toBe(true)
    if (!response.ok || !('updated' in response)) {
      return
    }
    expect(response.updated).toBe(1)

    const fetched = await handleGetMemoryItem({ id: captured.item.id })
    expect(fetched.ok).toBe(true)
    if (!fetched.ok || !('item' in fetched)) {
      return
    }
    expect(fetched.item.clues.dismissCount).toBe(1)
    expect(fetched.item.clues.lastDismissedAt).toBeTruthy()
  })

  it('handleListMemoryItems 透传 offset 给 service.list', async () => {
    const { memoryItemService } = await import('@/application/memory/memory-item-service')
    const listSpy = vi.spyOn(memoryItemService, 'list').mockResolvedValue([])
    const countSpy = vi.spyOn(memoryItemService, 'countActive').mockResolvedValue(0)
    try {
      const response = await handleListMemoryItems({
        type: 'text_excerpt',
        limit: 200,
        offset: 200
      })
      expect(response.ok).toBe(true)
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text_excerpt',
          limit: 200,
          offset: 200
        })
      )
    } finally {
      listSpy.mockRestore()
      countSpy.mockRestore()
    }
  })

  it('handleListMemoryItems 透传 query/sort 且 total 为过滤后总数', async () => {
    const { memoryItemService } = await import('@/application/memory/memory-item-service')
    const listSpy = vi.spyOn(memoryItemService, 'list').mockResolvedValue([])
    const countSpy = vi.spyOn(memoryItemService, 'countActive').mockResolvedValue(7)
    try {
      const response = await handleListMemoryItems({
        type: 'text_excerpt',
        limit: 50,
        query: 'needle',
        sort: 'oldest'
      })
      expect(response.ok).toBe(true)
      if (!response.ok || !('total' in response)) {
        return
      }
      expect(response.total).toBe(7)
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text_excerpt',
          limit: 50,
          query: 'needle',
          sort: 'oldest'
        })
      )
      expect(countSpy).toHaveBeenCalledWith('text_excerpt', 'needle')
    } finally {
      listSpy.mockRestore()
      countSpy.mockRestore()
    }
  })
})
