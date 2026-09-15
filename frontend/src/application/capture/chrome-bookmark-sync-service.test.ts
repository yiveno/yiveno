import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/application/memory/schedule-async-memory-llm-enrichment', () => ({
  scheduleAsyncMemoryLlmEnrichment: vi.fn(),
  clearAsyncMemoryLlmEnrichmentQueue: vi.fn()
}))

vi.mock('@/application/memory/schedule-async-memory-embedding', () => ({
  scheduleAsyncMemoryEmbedding: vi.fn(),
  clearAsyncMemoryEmbeddingQueue: vi.fn()
}))

vi.mock('@/application/memory/ensure-memory-embedding-maintenance', () => ({
  scheduleSilentMemoryEmbeddingMaintenance: vi.fn(),
  EMBEDDING_MAINTENANCE_AFTER_SYNC_DELAY_MS: 3500
}))

import {
  flushPendingChromeBookmarkSync,
  handleChromeBookmarkChanged,
  handleChromeBookmarkCreated,
  handleChromeBookmarkRemoved,
  reconcileChromeBookmarksWithMemory,
  resetPendingChromeBookmarkSyncForTests
} from '@/application/capture/chrome-bookmark-sync-service'
import { scheduleAsyncMemoryEmbedding } from '@/application/memory/schedule-async-memory-embedding'
import { scheduleSilentMemoryEmbeddingMaintenance } from '@/application/memory/ensure-memory-embedding-maintenance'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { logger } from '@/infrastructure/logging/logger'
import { CHROME_BOOKMARK_IMPORT_STORAGE_KEY } from '@/core/memory/chrome-bookmark-import-state'
import { CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY } from '@/core/memory/chrome-bookmark-sync-pending'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { DEFAULT_USER_SETTINGS, USER_SETTINGS_STORAGE_KEY } from '@/core/settings/user-settings'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

type StorageMap = Record<string, unknown>

function createChromeMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  const sessionStore: StorageMap = {}
  const bookmarks = new Map<string, chrome.bookmarks.BookmarkTreeNode>([
    [
      '10',
      {
        id: '10',
        title: 'Retention analysis',
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
        remove: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys]
          for (const key of list) {
            delete store[key]
          }
        })
      },
      session: {
        get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === 'string') {
            return { [keys]: sessionStore[keys] }
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map(key => [key, sessionStore[key]]))
          }
          return { ...sessionStore, ...keys }
        }),
        set: vi.fn(async (items: StorageMap) => {
          Object.assign(sessionStore, items)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys]
          for (const key of list) {
            delete sessionStore[key]
          }
        })
      }
    },
    bookmarks: {
      get: vi.fn(async (id: string | string[]) => {
        const ids = Array.isArray(id) ? id : [id]
        return ids
          .map(itemId => bookmarks.get(itemId))
          .filter(Boolean) as chrome.bookmarks.BookmarkTreeNode[]
      }),
      getTree: vi.fn(async () => [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bookmarks bar',
              children: [...bookmarks.values()]
            }
          ]
        }
      ]),
      onCreated: { addListener: vi.fn() },
      onChanged: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      onMoved: { addListener: vi.fn() }
    },
    __bookmarks: bookmarks,
    __store: store,
    __sessionStore: sessionStore
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
    vi.clearAllMocks()
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: completedImportState,
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

  it('handleChromeBookmarkCreated upsert 新书签', async () => {
    const result = await handleChromeBookmarkCreated({
      id: '10',
      title: 'Retention analysis',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    expect(result.captured).toBe(true)
    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
    if (items[0]?.type === 'bookmark') {
      expect(items[0].payload.chromeBookmarkId).toBe('10')
    }
    expect(scheduleAsyncMemoryEmbedding).toHaveBeenCalledWith(items[0]!.id)
    expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalledWith(
      'chrome_bookmark_created',
      3500
    )
  })

  it('handleChromeBookmarkCreated 对文件夹不标记 captured', async () => {
    vi.mocked(scheduleAsyncMemoryEmbedding).mockClear()
    vi.mocked(scheduleSilentMemoryEmbeddingMaintenance).mockClear()
    const result = await handleChromeBookmarkCreated({
      id: 'folder-1',
      title: 'Work',
      parentId: '1'
    })
    expect(result.captured).toBe(false)
    expect(scheduleAsyncMemoryEmbedding).not.toHaveBeenCalled()
  })

  it('handleChromeBookmarkChanged 更新已有书签', async () => {
    await handleChromeBookmarkCreated({
      id: '10',
      title: 'Old title',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    const chromeMock = chrome as ReturnType<typeof createChromeMock>
    chromeMock.__bookmarks.set('10', {
      id: '10',
      title: 'New title',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    await handleChromeBookmarkChanged('10')

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
    if (items[0]?.type === 'bookmark') {
      expect(items[0].payload.title).toBe('New title')
    }
    expect(scheduleAsyncMemoryEmbedding).toHaveBeenCalledWith(items[0]!.id)
    expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalledWith(
      'chrome_bookmark_changed',
      3500
    )
  })

  it('handleChromeBookmarkRemoved 软删除 MemoryItem', async () => {
    await handleChromeBookmarkCreated({
      id: '10',
      title: 'Retention analysis',
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
      },
      [USER_SETTINGS_STORAGE_KEY]: {
        ...DEFAULT_USER_SETTINGS,
        chromeBookmarkIngestEnabled: true
      }
    })
    vi.stubGlobal('chrome', chromeMock)

    await handleChromeBookmarkCreated({
      id: '10',
      title: 'Retention analysis',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    expect(await memoryItemRepository.listByOwner({ type: 'bookmark' })).toHaveLength(0)

    chromeMock.__store[CHROME_BOOKMARK_IMPORT_STORAGE_KEY] = completedImportState

    await flushPendingChromeBookmarkSync()

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
  })

  it('关闭书签灌库时跳过 created（不入队）', async () => {
    const { USER_SETTINGS_STORAGE_KEY } = await import('@/core/settings/user-settings')
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: completedImportState,
        [USER_SETTINGS_STORAGE_KEY]: {
          selectionToolbarEnabled: true,
          aiFeaturesEnabled: true,
          chromeBookmarkIngestEnabled: false
        }
      })
    )

    const result = await handleChromeBookmarkCreated({
      id: '10',
      title: 'Retention analysis',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    expect(result.captured).toBe(false)
    expect(await memoryItemRepository.listByOwner({ type: 'bookmark' })).toHaveLength(0)
  })

  it('导入未完成时 pending 写入 session，模拟 SW 重启后 flush 仍可恢复', async () => {
    const chromeMock = createChromeMock({
      [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
      [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: {
        status: 'running',
        importedCount: 0,
        totalCount: 1,
        startedAt: '2026-07-22T05:00:00.000Z'
      },
      [USER_SETTINGS_STORAGE_KEY]: {
        ...DEFAULT_USER_SETTINGS,
        chromeBookmarkIngestEnabled: true
      }
    })
    vi.stubGlobal('chrome', chromeMock)

    await handleChromeBookmarkCreated({
      id: '10',
      title: 'Retention analysis',
      url: 'https://example.com/retention',
      parentId: '1'
    })

    expect(chromeMock.__sessionStore[CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY]).toEqual({
      upsertIds: ['10'],
      removeIds: []
    })

    // 模拟 SW 重启：清空内存 pending，保留 session
    resetPendingChromeBookmarkSyncForTests()
    chromeMock.__store[CHROME_BOOKMARK_IMPORT_STORAGE_KEY] = completedImportState

    await flushPendingChromeBookmarkSync()

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
    expect(chromeMock.__sessionStore[CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY]).toBeUndefined()
  })

  it('reconcile 补写 Chrome 有、Memory 无的书签', async () => {
    const chromeMock = createChromeMock({
      [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
      [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: completedImportState,
      [USER_SETTINGS_STORAGE_KEY]: {
        ...DEFAULT_USER_SETTINGS,
        chromeBookmarkIngestEnabled: true
      }
    })
    chromeMock.__bookmarks.set('20', {
      id: '20',
      title: 'Source video roundup',
      url: 'https://www.youtube.com/watch?v=dQAmmIdSRSY',
      parentId: '1'
    })
    vi.stubGlobal('chrome', chromeMock)

    expect(await memoryItemRepository.listByOwner({ type: 'bookmark' })).toHaveLength(0)

    const result = await reconcileChromeBookmarksWithMemory()
    expect(result.skipped).toBe(false)
    expect(result.upserted).toBe(2)

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(2)
    const chromeIds = items
      .filter(item => item.type === 'bookmark')
      .map(item => (item.type === 'bookmark' ? item.payload.chromeBookmarkId : undefined))
      .sort()
    expect(chromeIds).toEqual(['10', '20'])
  })

  it('reconcile 配额耗尽时只记一次并中止后续 upsert', async () => {
    const chromeMock = createChromeMock({
      [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
      [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: completedImportState,
      [USER_SETTINGS_STORAGE_KEY]: {
        ...DEFAULT_USER_SETTINGS,
        chromeBookmarkIngestEnabled: true
      }
    })
    for (let index = 30; index < 35; index += 1) {
      chromeMock.__bookmarks.set(String(index), {
        id: String(index),
        title: `Quota leaf ${index}`,
        url: `https://example.com/${index}`,
        parentId: '1'
      })
    }
    vi.stubGlobal('chrome', chromeMock)

    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    const upsertSpy = vi
      .spyOn(memoryItemService, 'upsertBookmarkFromChrome')
      .mockRejectedValue(quota)
    const errorSpy = vi.spyOn(logger, 'error')

    const first = await reconcileChromeBookmarksWithMemory()
    expect(first.skipped).toBe(false)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls.filter(call => String(call[1]).includes('配额耗尽')).length).toBe(1)

    const second = await reconcileChromeBookmarksWithMemory()
    expect(second.skipped).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1)

    upsertSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
