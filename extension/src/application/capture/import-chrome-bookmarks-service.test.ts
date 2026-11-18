import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ensureChromeBookmarksImported,
  flushScheduledChromeBookmarkEnsureForTests,
  resetChromeBookmarkImportAfterLocalClear,
  scheduleEnsureChromeBookmarksImportedIfNeeded
} from '@/application/capture/import-chrome-bookmarks-service'
import * as bulkImport from '@/application/capture/chrome-bookmark-bulk-import'
import { resetPendingChromeBookmarkSyncForTests } from '@/application/capture/chrome-bookmark-sync-service'
import * as alignmentCache from '@/application/memory/bookmark-sync-alignment-cache'
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
    // 先排空上一条 schedule，再复位终态标志（避免测间竞态）
    await flushScheduledChromeBookmarkEnsureForTests()
    await resetChromeBookmarkImportAfterLocalClear()
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

  it('已完成后再次调用跳过 bulk；sync 开时仍 reconcile', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [USER_SETTINGS_STORAGE_KEY]: {
          ...DEFAULT_USER_SETTINGS,
          chromeBookmarkIngestEnabled: true,
          chromeBookmarkSyncEnabled: true
        }
      })
    )
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

  it('空树直接 completed，不写 running、不调 bulk', async () => {
    const writeSpy = vi.spyOn(bulkImport, 'writeChromeBookmarkImportState')
    const bulkSpy = vi.spyOn(bulkImport, 'bulkPutChromeBookmarkLeaves')
    try {
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
      ;(chrome.bookmarks.getTree as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: '0', title: '', children: [] }
      ])

      const state = await ensureChromeBookmarksImported()
      expect(state.status).toBe('completed')
      expect(state.importedCount).toBe(0)
      expect(state.totalCount).toBe(0)
      expect(bulkSpy).not.toHaveBeenCalled()
      const statuses = writeSpy.mock.calls.map(call => (call[0] as { status: string }).status)
      expect(statuses).not.toContain('running')
      expect(statuses).toContain('completed')
    } finally {
      writeSpy.mockRestore()
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

  it('导入完成后失效对齐缓存，下次读取反映新对齐', async () => {
    const invalidateSpy = vi.spyOn(alignmentCache, 'invalidateBookmarkSyncAlignmentCache')
    await alignmentCache.getBookmarkSyncAlignmentCached()
    expect((await alignmentCache.getBookmarkSyncAlignmentCached()).byChromeBookmarkId.size).toBe(0)

    await ensureChromeBookmarksImported()
    expect(invalidateSpy).toHaveBeenCalled()

    const after = await alignmentCache.getBookmarkSyncAlignmentCached()
    expect(after.byChromeBookmarkId.has('10')).toBe(true)
    invalidateSpy.mockRestore()
  })

  it('导入写阶段失败也会失效对齐缓存', async () => {
    const invalidateSpy = vi.spyOn(alignmentCache, 'invalidateBookmarkSyncAlignmentCache')
    const bulkSpy = vi
      .spyOn(bulkImport, 'bulkPutChromeBookmarkLeaves')
      .mockRejectedValue(new Error('write boom'))

    await expect(ensureChromeBookmarksImported()).rejects.toThrow('write boom')
    expect(invalidateSpy).toHaveBeenCalled()

    bulkSpy.mockRestore()
    invalidateSpy.mockRestore()
  })

  it('状态重置后单次导入行数等于树大小且无重复', async () => {
    await ensureChromeBookmarksImported()
    expect(await memoryItemRepository.listByOwner({ type: 'bookmark' })).toHaveLength(1)

    await resetChromeBookmarkImportAfterLocalClear()
    // 模拟孤儿清空后行还在 / 或仅状态抹掉后重导：再跑 ensure 不得翻倍
    const state = await ensureChromeBookmarksImported()
    expect(state.status).toBe('completed')
    expect(await memoryItemRepository.listByOwner({ type: 'bookmark' })).toHaveLength(1)
  })

  it('F6：终态标志被 completed 消费后，卡住的 running 仍可续跑', async () => {
    scheduleEnsureChromeBookmarksImportedIfNeeded('test_completed_first')
    await flushScheduledChromeBookmarkEnsureForTests()
    expect((await bulkImport.readChromeBookmarkImportState())?.status).toBe('completed')

    await bulkImport.writeChromeBookmarkImportState({
      status: 'running',
      importedCount: 0,
      totalCount: 1,
      startedAt: '2026-07-22T05:00:00.000Z'
    })
    // 清掉已写入行，便于断言续跑 bulk 再写
    const existing = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    if (existing.length > 0) {
      await memoryItemRepository.hardDeleteMany(existing.map(item => item.id))
    }

    const bulkSpy = vi.spyOn(bulkImport, 'bulkPutChromeBookmarkLeaves')
    try {
      scheduleEnsureChromeBookmarksImportedIfNeeded('test_running_heal')
      await flushScheduledChromeBookmarkEnsureForTests()
      expect(bulkSpy).toHaveBeenCalled()
      expect((await bulkImport.readChromeBookmarkImportState())?.status).toBe('completed')
    } finally {
      bulkSpy.mockRestore()
    }
  })

  it('completed 时两次 schedule 只 ensure 一次（终态标志）', async () => {
    await ensureChromeBookmarksImported()
    const readSpy = vi.spyOn(bulkImport, 'readChromeBookmarkImportState')

    try {
      readSpy.mockClear()
      scheduleEnsureChromeBookmarksImportedIfNeeded('test_completed_a')
      await flushScheduledChromeBookmarkEnsureForTests()
      const afterFirst = readSpy.mock.calls.length
      // schedule 读一次 + ensure 内再读（completed 早退）
      expect(afterFirst).toBeGreaterThanOrEqual(2)

      scheduleEnsureChromeBookmarksImportedIfNeeded('test_completed_b')
      await flushScheduledChromeBookmarkEnsureForTests()
      // 终态已消费：只再读一次状态即 return，不再进 ensure
      expect(readSpy.mock.calls.length - afterFirst).toBe(1)
    } finally {
      readSpy.mockRestore()
    }
  })

  it('failed 时两次 schedule 只尝试一次（终态标志不风暴）', async () => {
    const bulkSpy = vi
      .spyOn(bulkImport, 'bulkPutChromeBookmarkLeaves')
      .mockRejectedValue(new Error('write boom'))

    try {
      scheduleEnsureChromeBookmarksImportedIfNeeded('test_failed_a')
      await flushScheduledChromeBookmarkEnsureForTests()
      expect((await bulkImport.readChromeBookmarkImportState())?.status).toBe('failed')
      expect(bulkSpy).toHaveBeenCalledTimes(1)

      scheduleEnsureChromeBookmarksImportedIfNeeded('test_failed_b')
      await flushScheduledChromeBookmarkEnsureForTests()
      expect(bulkSpy).toHaveBeenCalledTimes(1)
    } finally {
      bulkSpy.mockRestore()
    }
  })

  it('同一 tick 两次 schedule 只跑一次 ensure（在途去重）', async () => {
    const bulkSpy = vi.spyOn(bulkImport, 'bulkPutChromeBookmarkLeaves')
    try {
      scheduleEnsureChromeBookmarksImportedIfNeeded('test_inflight_a')
      scheduleEnsureChromeBookmarksImportedIfNeeded('test_inflight_b')
      await flushScheduledChromeBookmarkEnsureForTests()
      expect(bulkSpy).toHaveBeenCalledTimes(1)
      expect((await bulkImport.readChromeBookmarkImportState())?.status).toBe('completed')
    } finally {
      bulkSpy.mockRestore()
    }
  })
})
