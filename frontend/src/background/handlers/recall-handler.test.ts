import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { handleRecallWithClue } from '@/background/handlers/recall-handler'
import { handleCaptureBookmark } from '@/background/handlers/memory-handler'
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

describe('recall-handler', () => {
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

  it('handleRecallWithClue 返回 Top Pick', async () => {
    await handleCaptureBookmark({
      title: '留存分析方法论',
      url: 'https://example.com/retention'
    })

    const response = await handleRecallWithClue({ clue: '留存' })
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.result.outcome).toBe('top_pick')
    expect(response.result.topPick?.item.payload).toMatchObject({
      title: '留存分析方法论'
    })
  })

  it('handleRecallWithClue 无数据时 no_match', async () => {
    const response = await handleRecallWithClue({ clue: '不存在的内容' })
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.result.outcome).toBe('no_match')
  })
})
