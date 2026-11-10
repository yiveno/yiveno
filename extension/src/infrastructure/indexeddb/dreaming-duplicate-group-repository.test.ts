import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildCaptureDreamingPreprocess } from '@/application/dreaming/capture-dreaming-preprocess'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { dreamingDuplicateGroupRepository } from '@/infrastructure/indexeddb/dreaming-duplicate-group-repository'
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

describe('dreaming-duplicate-group-repository', () => {
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

  it('同一选区点两次仍是两条 Memory 行；duplicate-group 记为一组', async () => {
    const payload = {
      selectedText: 'duplicate group shared excerpt body text here',
      sourceUrl: 'https://example.com/g',
      pageTitle: 'G',
      domain: 'example.com'
    }

    const first = await memoryItemRepository.createTextExcerpt({
      payload,
      captureEntry: 'context_menu'
    })
    const second = await memoryItemRepository.createTextExcerpt({
      payload,
      captureEntry: 'context_menu'
    })

    expect(first.id).not.toBe(second.id)
    expect(first.type).toBe('text_excerpt')
    expect(second.type).toBe('text_excerpt')
    if (first.type !== 'text_excerpt' || second.type !== 'text_excerpt') {
      throw new Error('expected text_excerpt')
    }
    expect(first.payload.selectedText).toBe(second.payload.selectedText)

    const link = buildCaptureDreamingPreprocess(first)
    const group = await dreamingDuplicateGroupRepository.getById(link.id)
    expect(group).not.toBeNull()
    expect(group!.sourceMemoryItemIds).toEqual(expect.arrayContaining([first.id, second.id]))
    expect(group!.sourceMemoryItemIds).toHaveLength(2)
  })
})
