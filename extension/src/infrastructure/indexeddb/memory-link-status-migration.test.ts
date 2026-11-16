/**
 * Phase 5：IDB v6 建 `memory_link_status` store。
 */

import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_STORE,
  MEMORY_LINK_STATUS_STORE,
  MEMORY_NOTES_META_STORE,
  MEMORY_NOTES_STORE
} from '@/infrastructure/indexeddb/constants'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryLinkStatusRepository } from '@/infrastructure/indexeddb/memory-link-status-repository'

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

describe('memory_link_status · v6 迁移', () => {
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

  it('MEMORY_DATABASE_VERSION≥6 且新库含 memory_link_status', async () => {
    expect(MEMORY_DATABASE_VERSION).toBeGreaterThanOrEqual(6)
    const { item } = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'link status migration smoke',
        sourceUrl: 'https://example.com/link',
        pageTitle: 'Link',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    expect(item.id).toBeTruthy()

    await memoryLinkStatusRepository.ensureReady()
    const ok = await indexedDBManager.withTransaction(
      [MEMORY_ITEM_STORE, MEMORY_NOTES_STORE, MEMORY_NOTES_META_STORE, MEMORY_LINK_STATUS_STORE],
      'readonly',
      async () => true
    )
    expect(ok).toBe(true)
    expect(MEMORY_DATABASE_NAME).toBe('YivenoMemoryDB')
  })
})
