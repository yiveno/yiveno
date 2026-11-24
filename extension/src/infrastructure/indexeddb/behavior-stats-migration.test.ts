/**
 * IDB v9：建 `behavior_stats` store；旧 memory_items 完好。
 */

import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  BEHAVIOR_STATS_STORE,
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_STORE,
  MEMORY_PAGE_PREVIEW_STORE
} from '@/infrastructure/indexeddb/constants'
import { behaviorStatsRepository } from '@/infrastructure/indexeddb/behavior-stats-repository'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
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
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete store[key]
      }
    })
  }
  return { storage: { local } }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('behavior_stats · v9 迁移', () => {
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

  it('MEMORY_DATABASE_VERSION≥9 且新库含 behavior_stats；旧条目完好', async () => {
    expect(MEMORY_DATABASE_VERSION).toBeGreaterThanOrEqual(9)
    const { item } = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'behavior stats migration smoke',
        sourceUrl: 'https://example.com/behavior',
        pageTitle: 'Behavior',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    expect(item.id).toBeTruthy()

    await behaviorStatsRepository.ensureReady()
    const written = await behaviorStatsRepository.upsert({
      ownerId: item.ownerId,
      url: 'https://github.com/yiveno#readme',
      visitCount: 3,
      lastVisitTime: Date.UTC(2026, 10, 20)
    })
    expect(written).not.toBeNull()
    expect(written!.url).toBe('https://github.com/yiveno')
    expect(written!.domain).toBe('github.com')
    expect(written!.totalDwellMs).toBe(0)

    const listed = await behaviorStatsRepository.listByOwner(item.ownerId)
    expect(listed).toHaveLength(1)

    const ok = await indexedDBManager.withTransaction(
      [MEMORY_ITEM_STORE, MEMORY_PAGE_PREVIEW_STORE, BEHAVIOR_STATS_STORE],
      'readonly',
      async () => true
    )
    expect(ok).toBe(true)
    expect(MEMORY_DATABASE_NAME).toBe('YivenoMemoryDB')

    const stillThere = await memoryItemRepository.getById(item.id)
    expect(stillThere?.id).toBe(item.id)
  })

  it('upsert 按 max(visitCount)/max(lastVisitTime) 合并且计数不降', async () => {
    const ownerId = localProfile.localProfileId
    await behaviorStatsRepository.ensureReady()
    await behaviorStatsRepository.upsert({
      ownerId,
      url: 'https://www.example.com/a',
      visitCount: 10,
      lastVisitTime: 1000
    })
    const merged = await behaviorStatsRepository.upsert({
      ownerId,
      url: 'https://www.example.com/a#frag',
      visitCount: 4,
      lastVisitTime: 2000
    })
    expect(merged!.visitCount).toBe(10)
    expect(merged!.lastVisitTime).toBe(2000)
    expect(merged!.domain).toBe('example.com')
  })
})
