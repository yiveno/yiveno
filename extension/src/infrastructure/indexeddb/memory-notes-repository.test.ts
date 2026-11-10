import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { advanceDreamRunCursor, startDreamRun } from '@/core/dreaming/dream-run-cursor'
import { DREAMING_PROPOSITION_MAX_CHARS } from '@/core/dreaming/dreaming-constants'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  KEYWORD_INDEX_META_STORE,
  KEYWORD_POSTING_STORE,
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_STORE,
  MEMORY_NOTES_META_STORE,
  MEMORY_NOTES_STORE
} from '@/infrastructure/indexeddb/constants'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { memoryDatabaseDefinition } from '@/infrastructure/indexeddb/memory-db-definition'
import { indexedDBManager, requestToPromise } from '@/infrastructure/indexeddb/manager'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryNotesMetaRepository } from '@/infrastructure/indexeddb/memory-notes-meta-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'

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

const SOURCE_ID = '22222222-2222-4222-8222-222222222222'

describe('memory_notes · v5 + 引用门 + 游标续跑', () => {
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

  it('新库跑满 v1–v5：含 memory_notes / meta，且 memory_items 可写', async () => {
    const item = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'dreaming migration smoke excerpt',
        sourceUrl: 'https://example.com/dream',
        pageTitle: 'Dream',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    expect(item.id).toBeTruthy()

    await memoryNotesRepository.ensureReady()
    const storeNames = await indexedDBManager.withTransaction(
      [MEMORY_ITEM_STORE, MEMORY_NOTES_STORE, MEMORY_NOTES_META_STORE],
      'readonly',
      async () => {
        // 事务能开 = store 已建
        return true
      }
    )
    expect(storeNames).toBe(true)
    expect(MEMORY_DATABASE_VERSION).toBe(5)
    expect(MEMORY_DATABASE_NAME).toBe('YivenoMemoryDB')
  })

  it('v4 旧库打开后自动升到 v5，memory_items 数据不受影响', async () => {
    // 先以 v4 定义建库并写入一条 memory_items
    const v4Definition = {
      name: MEMORY_DATABASE_NAME,
      version: 4,
      upgrade: (database: IDBDatabase, _transaction: IDBTransaction, oldVersion: number): void => {
        if (oldVersion < 1) {
          const store = database.createObjectStore(MEMORY_ITEM_STORE, { keyPath: 'id' })
          store.createIndex('by_owner_updated', ['ownerId', 'updatedAt'], { unique: false })
          store.createIndex('by_owner_type_updated', ['ownerId', 'type', 'updatedAt'], {
            unique: false
          })
          store.createIndex('by_owner', 'ownerId', { unique: false })
          store.createIndex('by_owner_chrome_bookmark', ['ownerId', 'payload.chromeBookmarkId'], {
            unique: false
          })
        }
        if (oldVersion < 4) {
          if (!database.objectStoreNames.contains(KEYWORD_POSTING_STORE)) {
            database.createObjectStore(KEYWORD_POSTING_STORE, { keyPath: 'id' })
          }
          if (!database.objectStoreNames.contains(KEYWORD_INDEX_META_STORE)) {
            database.createObjectStore(KEYWORD_INDEX_META_STORE, { keyPath: 'ownerId' })
          }
        }
      }
    }

    await indexedDBManager.initialize(v4Definition)
    const seedId = '33333333-3333-4333-8333-333333333333'
    await indexedDBManager.withTransaction(MEMORY_ITEM_STORE, 'readwrite', async transaction => {
      await requestToPromise(
        transaction.objectStore(MEMORY_ITEM_STORE).put({
          id: seedId,
          ownerId: localProfile.localProfileId,
          sourceLocalProfileId: localProfile.localProfileId,
          type: 'text_excerpt',
          payload: {
            selectedText: 'pre-v5 seed',
            sourceUrl: 'https://example.com/seed',
            pageTitle: 'Seed',
            domain: 'example.com'
          },
          clues: {
            keywords: [],
            entities: [],
            tags: [],
            openCount: 0,
            settledCount: 0,
            dismissCount: 0
          },
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          deletedAt: null
        })
      )
    })
    indexedDBManager.close()
    resetMemoryDatabaseInitializationForTests()

    // 再以现行 v5 定义打开 → 升版
    await indexedDBManager.initialize(memoryDatabaseDefinition)
    const surviving = await indexedDBManager.withTransaction(
      MEMORY_ITEM_STORE,
      'readonly',
      async transaction => requestToPromise(transaction.objectStore(MEMORY_ITEM_STORE).get(seedId))
    )
    expect((surviving as { id?: string } | undefined)?.id).toBe(seedId)

    const notesOk = await indexedDBManager.withTransaction(
      [MEMORY_NOTES_STORE, MEMORY_NOTES_META_STORE],
      'readonly',
      async () => true
    )
    expect(notesOk).toBe(true)
  })

  it('无 sourceQuote（且无 span）的命题不得入库', async () => {
    await memoryNotesRepository.ensureReady()
    const rejected = await memoryNotesRepository.putProposition({
      ownerId: localProfile.localProfileId,
      sourceMemoryItemId: SOURCE_ID,
      sourceType: 'text_excerpt',
      text: 'a proposition without citation',
      sourceQuote: '   ',
      dreamRunId: 'dream_test_no_quote',
      sourceUpdatedAt: '2026-11-10T00:00:00.000Z',
      propositionIndex: 0
    })
    expect(rejected).toBeNull()
    const listed = await memoryNotesRepository.listBySource({
      ownerId: localProfile.localProfileId,
      sourceMemoryItemId: SOURCE_ID
    })
    expect(listed).toEqual([])
  })

  it('有 sourceQuote 的命题可入库；超长正文拒绝', async () => {
    await memoryNotesRepository.ensureReady()
    const ok = await memoryNotesRepository.putProposition({
      ownerId: localProfile.localProfileId,
      sourceMemoryItemId: SOURCE_ID,
      sourceType: 'text_excerpt',
      text: 'People organize information so they can find it later.',
      sourceQuote: 'organize information',
      dreamRunId: 'dream_test_ok',
      sourceUpdatedAt: '2026-11-10T00:00:00.000Z',
      propositionIndex: 0
    })
    expect(ok).not.toBeNull()
    expect(ok?.sourceQuote).toBe('organize information')

    const tooLong = 'x'.repeat(DREAMING_PROPOSITION_MAX_CHARS + 1)
    const rejected = await memoryNotesRepository.putProposition({
      ownerId: localProfile.localProfileId,
      sourceMemoryItemId: SOURCE_ID,
      sourceType: 'text_excerpt',
      text: tooLong,
      sourceQuote: 'organize information',
      dreamRunId: 'dream_test_long',
      sourceUpdatedAt: '2026-11-10T00:00:00.000Z',
      propositionIndex: 1
    })
    expect(rejected).toBeNull()
    expect(DREAMING_PROPOSITION_MAX_CHARS).toBe(400)
  })

  it('游标续跑：提交后中断，下次从 lastCursor 继续且不重处理', async () => {
    const ownerId = localProfile.localProfileId
    const run = startDreamRun(1_700_000_000_000)
    const afterA = advanceDreamRunCursor(run, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    await memoryNotesMetaRepository.commitRunCursor(ownerId, afterA, 1)

    const resumed = await memoryNotesMetaRepository.readRunCursor(ownerId)
    expect(resumed?.dreamRunId).toBe(run.dreamRunId)
    expect(resumed?.lastCursor).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')

    // 模拟「下次 tick」：同 run 续跑，不应把 lastCursor 清掉
    const again = await memoryNotesMetaRepository.readRunCursor(ownerId)
    expect(again?.lastCursor).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })
})
