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

  it('upsertBookmarkFromChrome 复活同 chromeBookmarkId 软删行且保留附注', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: {
        title: '旧标题',
        url: 'https://revive.example.com/old',
        chromeBookmarkId: 'chrome-revive-1'
      },
      captureEntry: 'sync',
      now: () => '2026-07-22T06:00:00.000Z'
    })
    await memoryItemRepository.updateNote(created.id, '私人附注')
    await memoryItemRepository.softDelete(created.id)

    expect(await memoryItemRepository.getByChromeBookmarkId('chrome-revive-1')).toBeNull()

    const revived = await memoryItemRepository.upsertBookmarkFromChrome({
      payload: {
        title: '新标题',
        url: 'https://revive.example.com/new',
        chromeBookmarkId: 'chrome-revive-1'
      },
      captureEntry: 'sync',
      now: () => '2026-07-22T07:00:00.000Z'
    })

    expect(revived.id).toBe(created.id)
    expect(revived.deletedAt).toBeNull()
    expect(revived.type).toBe('bookmark')
    if (revived.type !== 'bookmark') {
      throw new Error('expected bookmark')
    }
    expect(revived.payload.title).toBe('新标题')
    expect(revived.payload.url).toBe('https://revive.example.com/new')
    expect(revived.clues.note).toBe('私人附注')

    const listed = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      includeDeleted: true
    })
    expect(
      listed.filter(
        item => item.type === 'bookmark' && item.payload.chromeBookmarkId === 'chrome-revive-1'
      )
    ).toHaveLength(1)
  })

  it('remapOwnerId 迁移归属并保留 sourceLocalProfileId', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: { title: 'Remap', url: 'https://remap.example.com' },
      now: () => '2026-08-03T06:00:00.000Z'
    })
    expect(created.ownerId).toBe(localProfile.localProfileId)

    const accountId = '22222222-2222-4222-8222-222222222222'
    const remapped = await memoryItemRepository.remapOwnerId(localProfile.localProfileId, accountId)
    expect(remapped).toBe(1)

    const underOld = await memoryItemRepository.listAllByOwnerId(localProfile.localProfileId)
    expect(underOld).toHaveLength(0)

    const underNew = await memoryItemRepository.listAllByOwnerId(accountId)
    expect(underNew).toHaveLength(1)
    expect(underNew[0]?.id).toBe(created.id)
    expect(underNew[0]?.sourceLocalProfileId).toBe(localProfile.localProfileId)
  })
})
