import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { bulkPutChromeBookmarkLeaves } from '@/application/capture/chrome-bookmark-bulk-import'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import type { ChromeBookmarkLeaf } from '@/infrastructure/browser/chrome-bookmark-reader'
import { MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE } from '@/infrastructure/indexeddb/constants'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

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
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

function createLeaves(count: number): ChromeBookmarkLeaf[] {
  return Array.from({ length: count }, (_, index) => ({
    chromeBookmarkId: String(index + 1),
    title: `Bookmark ${index + 1}`,
    url: `https://example.com/${index + 1}`
  }))
}

describe('chrome-bookmark-bulk-import', () => {
  beforeEach(async () => {
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  // fake-idb 大批量 putMany 在全仓并行时偶发贴近默认 10s；单独跑约 7s
  it('bulkPutChromeBookmarkLeaves 按批 putMany 写入', { timeout: 30_000 }, async () => {
    const putManySpy = vi.spyOn(memoryItemRepository, 'putMany')
    const leaves = createLeaves(MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE + 10)

    const imported = await bulkPutChromeBookmarkLeaves(leaves)
    expect(imported).toBe(leaves.length)
    expect(putManySpy).toHaveBeenCalledTimes(2)
    expect(putManySpy.mock.calls[0]?.[0]).toHaveLength(MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE)

    const stored = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      limit: Number.MAX_SAFE_INTEGER
    })
    expect(stored).toHaveLength(leaves.length)
  })

  it('bulkPutChromeBookmarkLeaves 过滤墓碑叶子', async () => {
    const { addChromeBookmarkDeleteTombstone } =
      await import('@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage')
    await addChromeBookmarkDeleteTombstone('2')
    const leaves = createLeaves(3)
    await bulkPutChromeBookmarkLeaves(leaves)
    const stored = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      limit: Number.MAX_SAFE_INTEGER
    })
    expect(stored).toHaveLength(2)
    const chromeIds = stored.map(item =>
      item.type === 'bookmark' ? item.payload.chromeBookmarkId : null
    )
    expect(chromeIds).toContain('1')
    expect(chromeIds).toContain('3')
    expect(chromeIds).not.toContain('2')
  })

  it('offset 0 扫除同 chromeBookmarkId 多活行并保留有 note 的一行', async () => {
    const shared = {
      title: 'Dup',
      url: 'https://example.com/dup',
      chromeBookmarkId: '99'
    }
    const a = await memoryItemRepository.createBookmark({
      payload: shared,
      captureEntry: 'sync',
      now: () => '2026-01-01T00:00:00.000Z'
    })
    await memoryItemRepository.updateNote(a.id, '保留附注')
    await memoryItemRepository.createBookmark({
      payload: shared,
      captureEntry: 'sync',
      now: () => '2026-01-02T00:00:00.000Z'
    })
    await memoryItemRepository.createBookmark({
      payload: shared,
      captureEntry: 'sync',
      now: () => '2026-01-03T00:00:00.000Z'
    })
    expect(
      await memoryItemRepository.listByOwner({ type: 'bookmark', limit: Number.MAX_SAFE_INTEGER })
    ).toHaveLength(3)

    await bulkPutChromeBookmarkLeaves([
      {
        chromeBookmarkId: '99',
        title: 'Dup',
        url: 'https://example.com/dup'
      }
    ])

    const stored = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      limit: Number.MAX_SAFE_INTEGER
    })
    expect(stored).toHaveLength(1)
    expect(stored[0]?.clues.note).toBe('保留附注')
  })

  it('连续两次 offset 0 bulk 导入行数恒等于叶子数', async () => {
    const leaves = createLeaves(5)
    await bulkPutChromeBookmarkLeaves(leaves)
    await bulkPutChromeBookmarkLeaves(leaves)
    const stored = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      limit: Number.MAX_SAFE_INTEGER
    })
    expect(stored).toHaveLength(5)
  })

  it('续传 startOffset>0 不跑扫除（既有行保留、仅 upsert 语义由上层负责）', async () => {
    const shared = {
      title: 'Keep dups on resume',
      url: 'https://example.com/resume-dup',
      chromeBookmarkId: '77'
    }
    await memoryItemRepository.createBookmark({
      payload: shared,
      captureEntry: 'sync',
      now: () => '2026-01-01T00:00:00.000Z'
    })
    await memoryItemRepository.createBookmark({
      payload: shared,
      captureEntry: 'sync',
      now: () => '2026-01-02T00:00:00.000Z'
    })

    // startOffset>0：不扫除；叶子切片为空时不写
    await bulkPutChromeBookmarkLeaves(createLeaves(2), 2)
    const stored = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      limit: Number.MAX_SAFE_INTEGER
    })
    expect(
      stored.filter(item => item.type === 'bookmark' && item.payload.chromeBookmarkId === '77')
    ).toHaveLength(2)
  })
})
