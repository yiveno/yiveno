import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  flushPendingChromeBookmarkSync,
  handleChromeBookmarkChanged,
  handleChromeBookmarkCreated,
  handleChromeBookmarkRemoved,
  resetPendingChromeBookmarkSyncForTests
} from '@/application/capture/chrome-bookmark-sync-service'
import { CHROME_BOOKMARK_IMPORT_STORAGE_KEY } from '@/core/memory/chrome-bookmark-import-state'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

type StorageMap = Record<string, unknown>

function createChromeMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  const bookmarks = new Map<string, chrome.bookmarks.BookmarkTreeNode>([
    [
      '10',
      {
        id: '10',
        title: '留存分析',
        url: 'https://example.com/retention',
        parentId: '1'
      }
    ]
  ])

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
    bookmarks: {
      get: vi.fn(async (id: string | string[]) => {
        const ids = Array.isArray(id) ? id : [id]
        return ids
          .map(itemId => bookmarks.get(itemId))
          .filter(Boolean) as chrome.bookmarks.BookmarkTreeNode[]
      }),
      getTree: vi.fn(async () => []),
      onCreated: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onMoved: { addListener: vi.fn() }
    },
    __bookmarks: bookmarks,
    __store: store
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

const completedImportState = {
  status: 'completed' as const,
  importedCount: 1,
  totalCount: 1,
  startedAt: '2026-07-22T05:00:00.000Z',
  completedAt: '2026-07-22T06:00:00.000Z'
}

describe('chrome-bookmark-sync-service', () => {
  beforeEach(async () => {
    resetPendingChromeBookmarkSyncForTests()
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: completedImportState
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('handleChromeBookmarkCreated upsert 新书签', async () => {
    const result = await handleChromeBookmarkCreated({
      id: '10',
      title: '留存分析',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    expect(result.captured).toBe(true)
    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
    if (items[0]?.type === 'bookmark') {
      expect(items[0].payload.chromeBookmarkId).toBe('10')
    }
  })

  it('handleChromeBookmarkCreated 对文件夹不标记 captured', async () => {
    const result = await handleChromeBookmarkCreated({
      id: 'folder-1',
      title: '工作',
      parentId: '1'
    })
    expect(result.captured).toBe(false)
  })

  it('handleChromeBookmarkChanged 更新已有书签', async () => {
    await handleChromeBookmarkCreated({
      id: '10',
      title: '旧标题',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    const chromeMock = chrome as ReturnType<typeof createChromeMock>
    chromeMock.__bookmarks.set('10', {
      id: '10',
      title: '新标题',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    await handleChromeBookmarkChanged('10')

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
    if (items[0]?.type === 'bookmark') {
      expect(items[0].payload.title).toBe('新标题')
    }
  })

  it('handleChromeBookmarkRemoved 软删除 MemoryItem', async () => {
    await handleChromeBookmarkCreated({
      id: '10',
      title: '留存分析',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    await handleChromeBookmarkRemoved('10')

    const active = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(active).toHaveLength(0)

    const deleted = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      includeDeleted: true
    })
    expect(deleted).toHaveLength(1)
    expect(deleted[0]?.deletedAt).toBeTruthy()
  })

  it('导入未完成时入队，flush 后写入', async () => {
    const chromeMock = createChromeMock({
      [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
      [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: {
        status: 'running',
        importedCount: 0,
        totalCount: 1,
        startedAt: '2026-07-22T05:00:00.000Z'
      }
    })
    vi.stubGlobal('chrome', chromeMock)

    await handleChromeBookmarkCreated({
      id: '10',
      title: '留存分析',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    expect(await memoryItemRepository.listByOwner({ type: 'bookmark' })).toHaveLength(0)

    chromeMock.__store[CHROME_BOOKMARK_IMPORT_STORAGE_KEY] = completedImportState

    await flushPendingChromeBookmarkSync()

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
  })
})
