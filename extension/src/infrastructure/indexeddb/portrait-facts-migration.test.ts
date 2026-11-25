/**
 * IDB v10：建 `portrait_facts` store；旧 memory_items 完好。
 */

import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_STORE,
  PORTRAIT_FACTS_STORE
} from '@/infrastructure/indexeddb/constants'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { portraitFactsRepository } from '@/infrastructure/indexeddb/portrait-facts-repository'
import { buildPortraitFactId, type PortraitFactRecord } from '@/core/portrait/portrait-facts'

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

describe('portrait_facts · v10 迁移', () => {
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

  it('MEMORY_DATABASE_VERSION≥10 且新库含 portrait_facts；旧条目完好', async () => {
    expect(MEMORY_DATABASE_VERSION).toBeGreaterThanOrEqual(10)
    const { item } = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'portrait migration smoke',
        sourceUrl: 'https://example.com/portrait',
        pageTitle: 'Portrait',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    expect(item.id).toBeTruthy()

    const now = new Date().toISOString()
    const record: PortraitFactRecord = {
      id: buildPortraitFactId(item.ownerId, 'contentTerm', 'github.com'),
      ownerId: item.ownerId,
      slot: 'contentTerm',
      value: 'github.com',
      credibility: 0.8,
      state: 'verified',
      sources: [{ type: 'behavior', ref: 'behavior:github.com', score: 0.8, observedAt: now }],
      inPortrait: true,
      createdAt: now,
      updatedAt: now
    }
    await portraitFactsRepository.put(record)
    const listed = await portraitFactsRepository.listByOwner(item.ownerId)
    expect(listed).toHaveLength(1)
    expect(listed[0]!.value).toBe('github.com')

    const ok = await indexedDBManager.withTransaction(
      [MEMORY_ITEM_STORE, PORTRAIT_FACTS_STORE],
      'readonly',
      async () => true
    )
    expect(ok).toBe(true)
    expect(MEMORY_DATABASE_NAME).toBe('YivenoMemoryDB')

    const stillThere = await memoryItemRepository.getById(item.id)
    expect(stillThere?.id).toBe(item.id)
  })

  it('decline 后行仍可读且 inPortrait=false', async () => {
    const ownerId = localProfile.localProfileId
    const now = new Date().toISOString()
    const id = buildPortraitFactId(ownerId, 'contentTerm', 'rag')
    await portraitFactsRepository.put({
      id,
      ownerId,
      slot: 'contentTerm',
      value: 'rag',
      credibility: 0.2,
      state: 'invalid',
      sources: [{ type: 'inference', ref: 'n', score: 0.4, observedAt: now }],
      inPortrait: false,
      createdAt: now,
      updatedAt: now
    })
    const row = await portraitFactsRepository.getById(id)
    expect(row?.state).toBe('invalid')
    expect(row?.inPortrait).toBe(false)
  })
})
