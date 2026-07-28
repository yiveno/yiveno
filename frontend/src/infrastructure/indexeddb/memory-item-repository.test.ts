import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }

  const local = {
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
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const key of keyList) {
        delete store[key]
      }
    })
  }

  return { storage: { local }, store }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('memory-item-repository', () => {
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

  it('createBookmark 写入并可按 owner 读取', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: {
        title: 'Yiveno Docs',
        url: 'https://yiveno.com/docs'
      },
      captureEntry: 'popup',
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const fetched = await memoryItemRepository.getById(created.id)
    expect(fetched).toEqual(created)

    const list = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(created.id)
  })

  it('createTextExcerpt 与其他 owner 隔离', async () => {
    const item = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: '一段文字',
        sourceUrl: 'https://example.com/article',
        pageTitle: '文章'
      },
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const otherOwner = await memoryItemRepository.getById(
      item.id,
      '99999999-9999-4999-8999-999999999999'
    )
    expect(otherOwner).toBeNull()

    await memoryItemRepository.softDelete(item.id)
    const active = await memoryItemRepository.listByOwner({ type: 'text_excerpt' })
    expect(active).toHaveLength(0)

    const includingDeleted = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      includeDeleted: true
    })
    expect(includingDeleted).toHaveLength(1)
    expect(includingDeleted[0]?.deletedAt).toBeTruthy()
  })

  it('countActiveByOwner 只统计未删除项', async () => {
    const first = await memoryItemRepository.createBookmark({
      payload: { title: 'A', url: 'https://a.example.com' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    await memoryItemRepository.createBookmark({
      payload: { title: 'B', url: 'https://b.example.com' },
      now: () => '2026-07-22T06:01:00.000Z'
    })

    expect(await memoryItemRepository.countActiveByOwner('bookmark')).toBe(2)

    await memoryItemRepository.softDelete(first.id)
    expect(await memoryItemRepository.countActiveByOwner('bookmark')).toBe(1)
  })

  it('recordDismiss 递增 dismissCount 且不改 updatedAt', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: { title: '可否定项', url: 'https://dismiss.example.com/item' },
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const dismissedAt = '2026-07-25T12:00:00.000Z'
    const updated = await memoryItemRepository.recordDismiss([created.id], dismissedAt)
    expect(updated).toBe(1)

    const fetched = await memoryItemRepository.getById(created.id)
    expect(fetched?.clues.dismissCount).toBe(1)
    expect(fetched?.clues.lastDismissedAt).toBe(dismissedAt)
    expect(fetched?.updatedAt).toBe(created.updatedAt)

    await memoryItemRepository.recordDismiss([created.id], '2026-07-26T12:00:00.000Z')
    const again = await memoryItemRepository.getById(created.id)
    expect(again?.clues.dismissCount).toBe(2)
    expect(again?.updatedAt).toBe(created.updatedAt)
  })

  it('recordDismiss 忽略不存在 id 并去重', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: { title: '唯一项', url: 'https://unique.example.com' },
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const updated = await memoryItemRepository.recordDismiss([
      created.id,
      created.id,
      '00000000-0000-4000-8000-000000000099'
    ])
    expect(updated).toBe(1)
  })
})
