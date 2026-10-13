import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ensureChromeBookmarksImported } from '@/application/capture/import-chrome-bookmarks-service'
import * as bulkImport from '@/application/capture/chrome-bookmark-bulk-import'
import { resetPendingChromeBookmarkSyncForTests } from '@/application/capture/chrome-bookmark-sync-service'
import { CHROME_BOOKMARK_IMPORT_STORAGE_KEY } from '@/core/memory/chrome-bookmark-import-state'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { DEFAULT_USER_SETTINGS, USER_SETTINGS_STORAGE_KEY } from '@/core/settings/user-settings'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

type StorageMap = Record<string, unknown>

function createChromeMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  const sessionStore: StorageMap = {}

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
      getTree: vi.fn(async () => [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bookmarks bar',
              children: [
                {
                  id: '10',
                  title: 'Retention analysis',
                  url: 'https://example.com/retention',
                  parentId: '1',
                  dateAdded: Date.parse('2026-01-01T00:00:00.000Z')
                },
                {
                  id: '11',
                  title: 'Ignore',
                  url: 'chrome://settings',
                  parentId: '1'
                }
              ]
            }
          ]
        }
      ]),
      get: vi.fn(async () => [])
    },
    tabs: {
      query: vi.fn(async () => [])
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('import-chrome-bookmarks-service', () => {
  beforeEach(async () => {
    resetPendingChromeBookmarkSyncForTests()
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeMock({
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

  it('首次导入把 Chrome 书签写入 IndexedDB', async () => {
    const state = await ensureChromeBookmarksImported()
    expect(state.status).toBe('completed')
    expect(state.importedCount).toBe(1)

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
    expect(items[0]?.type).toBe('bookmark')
    if (items[0]?.type === 'bookmark') {
      expect(items[0].payload.chromeBookmarkId).toBe('10')
      expect(items[0].payload.title).toBe('Retention analysis')
    }
  })

  it('已完成后再次调用跳过 bulk，但仍 reconcile', async () => {
    await ensureChromeBookmarksImported()
    const getTree = chrome.bookmarks.getTree as ReturnType<typeof vi.fn>
    const bulkSpy = vi.spyOn(bulkImport, 'bulkPutChromeBookmarkLeaves')
    getTree.mockClear()
    bulkSpy.mockClear()

    try {
      const state = await ensureChromeBookmarksImported()
      expect(state.status).toBe('completed')
      expect(bulkSpy).not.toHaveBeenCalled()
      // completed 路径走 reconcile，会再读一次 Chrome 树
      expect(getTree).toHaveBeenCalled()
    } finally {
      bulkSpy.mockRestore()
    }
  })

  it('upsert 同一 chromeBookmarkId 不重复创建', async () => {
    await ensureChromeBookmarksImported()

    await memoryItemRepository.upsertBookmarkFromChrome({
      payload: {
        title: 'Retention analysis (updated)',
        url: 'https://example.com/retention',
        chromeBookmarkId: '10'
      },
      captureEntry: 'sync'
    })

    const items = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(items).toHaveLength(1)
    if (items[0]?.type === 'bookmark') {
      expect(items[0].payload.title).toBe('Retention analysis (updated)')
    }
  })

  it('失败状态允许下次重试', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: {
          status: 'failed',
          importedCount: 0,
          startedAt: '2026-07-22T05:00:00.000Z',
          error: 'previous failure'
        },
        [USER_SETTINGS_STORAGE_KEY]: {
          ...DEFAULT_USER_SETTINGS,
          chromeBookmarkIngestEnabled: true
        }
      })
    )

    const state = await ensureChromeBookmarksImported()
    expect(state.status).toBe('completed')
    expect(state.importedCount).toBe(1)
  })

  it('续传时走 upsert 路径而非 bulk', async () => {
    const bulkSpy = vi.spyOn(bulkImport, 'bulkPutChromeBookmarkLeaves')
    const upsertSpy = vi.spyOn(bulkImport, 'upsertChromeBookmarkLeaves')

    try {
      vi.stubGlobal('chrome', {
        ...createChromeMock({
          [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
          [CHROME_BOOKMARK_IMPORT_STORAGE_KEY]: {
            status: 'failed',
            importedCount: 1,
            totalCount: 2,
            startedAt: '2026-07-22T05:00:00.000Z',
            error: 'interrupted'
          },
          [USER_SETTINGS_STORAGE_KEY]: {
            ...DEFAULT_USER_SETTINGS,
            chromeBookmarkIngestEnabled: true
          }
        }),
        bookmarks: {
          getTree: vi.fn(async () => [
            {
              id: '0',
              title: '',
              children: [
                {
                  id: '1',
                  title: 'Bookmarks bar',
                  children: [
                    {
                      id: '10',
                      title: 'First entry',
                      url: 'https://example.com/one',
                      parentId: '1'
                    },
                    {
                      id: '11',
                      title: 'Second entry',
                      url: 'https://example.com/two',
                      parentId: '1'
                    }
                  ]
                }
              ]
            }
          ]),
          get: vi.fn(async () => [])
        }
      })

      await memoryItemRepository.createBookmark({
        payload: {
          title: 'First entry',
          url: 'https://example.com/one',
          chromeBookmarkId: '10'
        },
        captureEntry: 'sync',
        now: () => '2026-07-22T06:00:00.000Z'
      })

      bulkSpy.mockClear()
      upsertSpy.mockClear()

      const state = await ensureChromeBookmarksImported()
      expect(state.status).toBe('completed')
      expect(state.importedCount).toBe(2)
      expect(bulkSpy).not.toHaveBeenCalled()
      expect(upsertSpy).toHaveBeenCalled()
    } finally {
      bulkSpy.mockRestore()
      upsertSpy.mockRestore()
    }
  })

  it('用户关闭书签灌库时跳过 bulk 导入', async () => {
    const { USER_SETTINGS_STORAGE_KEY: userSettingsStorageKey } =
      await import('@/core/settings/user-settings')
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [userSettingsStorageKey]: {
          selectionToolbarEnabled: true,
          aiFeaturesEnabled: true,
          chromeBookmarkIngestEnabled: false
        }
      })
    )

    const state = await ensureChromeBookmarksImported()
    expect(state.status).toBe('pending')
    expect(state.importedCount).toBe(0)
    expect(await memoryItemRepository.listByOwner({ type: 'bookmark' })).toHaveLength(0)
    expect(chrome.bookmarks.getTree).not.toHaveBeenCalled()
  })
})
