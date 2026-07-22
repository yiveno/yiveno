import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  handleCaptureBookmark,
  handleCaptureCurrentPage,
  handleListMemoryItems
} from '@/background/handlers/memory-handler'
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
    },
    tabs: {
      query: vi.fn(async () => [
        {
          title: 'Example Page',
          url: 'https://example.com/article',
          favIconUrl: 'https://example.com/favicon.ico'
        }
      ])
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('memory-handler', () => {
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

  it('handleCaptureBookmark 写入并返回 MemoryItem', async () => {
    const response = await handleCaptureBookmark({
      title: 'Yiveno',
      url: 'https://yiveno.com'
    })

    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.item.type).toBe('bookmark')
    expect(response.item.payload.title).toBe('Yiveno')
  })

  it('handleListMemoryItems 返回当前用户条目', async () => {
    await handleCaptureBookmark({
      title: 'First',
      url: 'https://first.example.com'
    })

    const response = await handleListMemoryItems({ limit: 10 })
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.total).toBe(1)
    expect(response.items[0]?.payload).toMatchObject({ title: 'First' })
  })

  it('handleCaptureBookmark 拒绝非法 payload', async () => {
    const response = await handleCaptureBookmark({ title: '', url: 'not-a-url' })
    expect(response.ok).toBe(false)
  })

  it('handleCaptureCurrentPage 读取活动标签并保存', async () => {
    const response = await handleCaptureCurrentPage({ captureEntry: 'popup' })
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.item.type).toBe('bookmark')
    expect(response.item.payload).toMatchObject({
      title: 'Example Page',
      url: 'https://example.com/article'
    })
  })
})
