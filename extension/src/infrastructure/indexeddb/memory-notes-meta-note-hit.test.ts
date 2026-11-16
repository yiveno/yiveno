/**
 * Phase 4.1：noteHitCounts 按 matchKind 分键，不得混同字面命中。
 */

import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { memoryNotesMetaRepository } from '@/infrastructure/indexeddb/memory-notes-meta-repository'
import { buildMemoryNoteId } from '@/infrastructure/indexeddb/memory-notes-types'

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
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key]
          }
        })
      }
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE = '11111111-1111-4111-8111-111111111129'
const NOTE_ID = buildMemoryNoteId(OWNER, SOURCE, 0)

describe('memory_notes_meta · noteHitCounts 按 kind', () => {
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

  it('literal 与 semantic 分键计数，互不混同', async () => {
    await memoryNotesMetaRepository.recordNoteHit(OWNER, NOTE_ID, 'literal')
    await memoryNotesMetaRepository.recordNoteHit(OWNER, NOTE_ID, 'literal')
    await memoryNotesMetaRepository.recordNoteHit(OWNER, NOTE_ID, 'semantic')
    const meta = await memoryNotesMetaRepository.getMeta(OWNER)
    expect(meta).not.toBeNull()
    expect(meta!.noteHitCounts[`${NOTE_ID}#literal`]).toBe(2)
    expect(meta!.noteHitCounts[`${NOTE_ID}#semantic`]).toBe(1)
    expect(meta!.noteHitCounts[NOTE_ID]).toBeUndefined()
  })
})
