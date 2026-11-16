import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addChromeBookmarkDeleteTombstone,
  readChromeBookmarkDeleteTombstoneIds
} from '@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage'
import { CHROME_BOOKMARK_TOMBSTONE_STORAGE_KEY } from '@/core/memory/chrome-bookmark-delete-tombstone'

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
        })
      }
    }
  }
}

describe('chrome-bookmark-delete-tombstone-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', createChromeStorageMock())
  })

  it('写/读往返', async () => {
    expect((await readChromeBookmarkDeleteTombstoneIds()).size).toBe(0)
    await addChromeBookmarkDeleteTombstone('chrome-a')
    await addChromeBookmarkDeleteTombstone('chrome-a')
    await addChromeBookmarkDeleteTombstone('chrome-b')
    const ids = await readChromeBookmarkDeleteTombstoneIds()
    expect(ids.has('chrome-a')).toBe(true)
    expect(ids.has('chrome-b')).toBe(true)
    expect(ids.size).toBe(2)
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [CHROME_BOOKMARK_TOMBSTONE_STORAGE_KEY]: {
        chromeBookmarkIds: ['chrome-a', 'chrome-b']
      }
    })
  })
})
