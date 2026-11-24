/**
 * Phase 4.1：IDB v7 建 `memory_note_embeddings` store（build-only + contains guard）。
 */

import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  MEMORY_DATABASE_NAME,
  MEMORY_DATABASE_VERSION,
  MEMORY_ITEM_STORE,
  MEMORY_LINK_STATUS_STORE,
  MEMORY_NOTE_EMBEDDING_STORE,
  MEMORY_NOTES_META_STORE,
  MEMORY_NOTES_STORE
} from '@/infrastructure/indexeddb/constants'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryNoteEmbeddingRepository } from '@/infrastructure/indexeddb/memory-note-embedding-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import { buildMemoryNoteId } from '@/infrastructure/indexeddb/memory-notes-types'

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

describe('memory_note_embeddings · v7 迁移', () => {
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

  it('MEMORY_DATABASE_VERSION≥7 且新库含 memory_note_embeddings', async () => {
    expect(MEMORY_DATABASE_VERSION).toBeGreaterThanOrEqual(7)
    const { item } = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'note embedding migration smoke',
        sourceUrl: 'https://example.com/embed',
        pageTitle: 'Embed',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    expect(item.id).toBeTruthy()

    await memoryNoteEmbeddingRepository.ensureReady()
    const ok = await indexedDBManager.withTransaction(
      [
        MEMORY_ITEM_STORE,
        MEMORY_NOTES_STORE,
        MEMORY_NOTES_META_STORE,
        MEMORY_LINK_STATUS_STORE,
        MEMORY_NOTE_EMBEDDING_STORE
      ],
      'readonly',
      async () => true
    )
    expect(ok).toBe(true)
    expect(MEMORY_DATABASE_NAME).toBe('YivenoMemoryDB')
  })

  it('向量写/读往返为 Float32Array；字面命题扫描不含向量字段', async () => {
    const { item } = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'literal note without embedding payload',
        sourceUrl: 'https://example.com/literal',
        pageTitle: 'Literal',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    const note = await memoryNotesRepository.putProposition({
      ownerId: item.ownerId,
      sourceMemoryItemId: item.id,
      sourceType: 'text_excerpt',
      text: 'The hostel costs thirty dollars a night.',
      sourceQuote: 'hostel costs thirty dollars',
      topicAnchor: ['hostel'],
      dreamRunId: 'run-embed-1',
      sourceUpdatedAt: item.updatedAt,
      propositionIndex: 0
    })
    expect(note).not.toBeNull()
    const noteId = note!.id
    expect(noteId).toBe(buildMemoryNoteId(item.ownerId, item.id, 0))

    const vector = Array.from({ length: 8 }, (_v, i) => (i % 2 === 0 ? 0.5 : -0.25))
    await memoryNoteEmbeddingRepository.putRecord({
      id: noteId,
      ownerId: item.ownerId,
      sourceMemoryItemId: item.id,
      inputText: 'The hostel costs thirty dollars a night.\nhostel costs thirty dollars',
      embedding: vector,
      embeddingModel: '@cf/baai/bge-m3',
      embeddingDim: 8,
      createdAt: item.updatedAt,
      updatedAt: item.updatedAt
    })

    const loaded = await memoryNoteEmbeddingRepository.getById(noteId)
    expect(loaded).not.toBeNull()
    expect(loaded!.embedding).toBeInstanceOf(Float32Array)
    expect([...loaded!.embedding]).toEqual(vector)

    const scanned = await memoryNotesRepository.listByOwnerUpdated({
      ownerId: item.ownerId,
      limit: 10
    })
    expect(scanned).toHaveLength(1)
    expect(scanned[0]!.embedding).toBeUndefined()
  })
})
