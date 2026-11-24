/**
 * page_preview store：读写、LRU、URL 键、节流判定。
 */

import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { shouldSkipOpenBackfillForThrottle } from '@/application/memory/page-preview-capture-service'
import {
  MEMORY_DATABASE_VERSION,
  MEMORY_PAGE_PREVIEW_STORE
} from '@/infrastructure/indexeddb/constants'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { pagePreviewRepository } from '@/infrastructure/indexeddb/page-preview-repository'
import {
  buildPagePreviewId,
  isCapturablePagePreviewUrl,
  normalizePagePreviewUrlKey,
  PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS,
  pickPagePreviewLruVictims
} from '@/infrastructure/indexeddb/page-preview-types'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'

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

const ownerId = '11111111-1111-4111-8111-111111111111'

function jpegBlob(size = 64): Blob {
  return new Blob([new Uint8Array(size)], { type: 'image/jpeg' })
}

describe('page-preview url helpers', () => {
  it('normalizePagePreviewUrlKey 去 hash、小写 host、去尾斜杠', () => {
    expect(normalizePagePreviewUrlKey('https://Example.com/a/b/?q=1#frag')).toBe(
      'https://example.com/a/b?q=1'
    )
    expect(normalizePagePreviewUrlKey('https://example.com/a/')).toBe('https://example.com/a')
    expect(normalizePagePreviewUrlKey('chrome://extensions')).toBeNull()
  })

  it('isCapturablePagePreviewUrl 拒绝 web store 与非 http', () => {
    expect(isCapturablePagePreviewUrl('https://example.com/x')).toBe(true)
    expect(isCapturablePagePreviewUrl('https://chromewebstore.google.com/detail/x')).toBe(false)
    expect(isCapturablePagePreviewUrl('chrome-extension://abc/sidepanel.html')).toBe(false)
  })

  it('shouldSkipOpenBackfillForThrottle 一周内跳过', () => {
    const now = Date.parse('2026-11-24T00:00:00.000Z')
    const recent = new Date(now - PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS + 1000).toISOString()
    const old = new Date(now - PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS - 1000).toISOString()
    expect(shouldSkipOpenBackfillForThrottle(recent, now)).toBe(true)
    expect(shouldSkipOpenBackfillForThrottle(old, now)).toBe(false)
    expect(shouldSkipOpenBackfillForThrottle(undefined, now)).toBe(false)
  })
})

describe('pagePreviewRepository', () => {
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

  it('MEMORY_DATABASE_VERSION≥8 且新库含 memory_page_previews', async () => {
    expect(MEMORY_DATABASE_VERSION).toBeGreaterThanOrEqual(8)
    await initializeMemoryDatabase()
    expect(indexedDBManager.isOpen()).toBe(true)
    await indexedDBManager.withTransaction(
      MEMORY_PAGE_PREVIEW_STORE,
      'readonly',
      async () => undefined
    )
  })

  it('put / get / touchShown 读写 Blob', async () => {
    const urlKey = 'https://example.com/preview'
    const blob = jpegBlob(128)
    const putResult = await pagePreviewRepository.putRecord({
      id: buildPagePreviewId(ownerId, urlKey),
      ownerId,
      urlKey,
      blob,
      byteSize: blob.size,
      width: 320,
      height: 200,
      capturedAt: '2026-11-20T00:00:00.000Z',
      lastShownAt: '2026-11-20T00:00:00.000Z',
      source: 'capture'
    })
    expect(putResult.evicted).toBe(0)

    const got = await pagePreviewRepository.getByUrl(ownerId, urlKey)
    expect(got?.byteSize).toBe(128)
    expect(got?.blob).toBeTruthy()
    expect(got?.width).toBe(320)

    const touched = await pagePreviewRepository.getAndTouchShown(
      ownerId,
      urlKey,
      '2026-11-24T12:00:00.000Z'
    )
    expect(touched?.lastShownAt).toBe('2026-11-24T12:00:00.000Z')
  })

  it('clearOwner 清空该 owner 全部预览', async () => {
    await pagePreviewRepository.putRecord({
      id: buildPagePreviewId(ownerId, 'https://example.com/a'),
      ownerId,
      urlKey: 'https://example.com/a',
      blob: jpegBlob(40),
      byteSize: 40,
      width: 320,
      height: 100,
      capturedAt: '2026-11-01T00:00:00.000Z',
      lastShownAt: '2026-11-01T00:00:00.000Z',
      source: 'capture'
    })
    await pagePreviewRepository.putRecord({
      id: buildPagePreviewId(ownerId, 'https://example.com/b'),
      ownerId,
      urlKey: 'https://example.com/b',
      blob: jpegBlob(40),
      byteSize: 40,
      width: 320,
      height: 100,
      capturedAt: '2026-11-02T00:00:00.000Z',
      lastShownAt: '2026-11-02T00:00:00.000Z',
      source: 'open_backfill'
    })

    expect(await pagePreviewRepository.listByOwner(ownerId)).toHaveLength(2)
    expect(await pagePreviewRepository.clearOwner(ownerId)).toBe(2)
    expect(await pagePreviewRepository.listByOwner(ownerId)).toHaveLength(0)
  })
})

describe('pickPagePreviewLruVictims', () => {
  it('超条数淘汰最久未展示，保留 keepId', () => {
    const victims = pickPagePreviewLruVictims(
      [
        {
          id: 'old',
          byteSize: 10,
          lastShownAt: '2026-01-01T00:00:00.000Z',
          capturedAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'mid',
          byteSize: 10,
          lastShownAt: '2026-02-01T00:00:00.000Z',
          capturedAt: '2026-02-01T00:00:00.000Z'
        },
        {
          id: 'keep',
          byteSize: 10,
          lastShownAt: '2026-03-01T00:00:00.000Z',
          capturedAt: '2026-03-01T00:00:00.000Z'
        }
      ],
      'keep',
      { maxEntries: 2, maxBytes: 10_000 }
    )
    expect(victims).toEqual(['old'])
  })

  it('超字节继续淘汰直到回到上限', () => {
    const victims = pickPagePreviewLruVictims(
      [
        {
          id: 'a',
          byteSize: 80,
          lastShownAt: '2026-01-01T00:00:00.000Z',
          capturedAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'b',
          byteSize: 80,
          lastShownAt: '2026-02-01T00:00:00.000Z',
          capturedAt: '2026-02-01T00:00:00.000Z'
        },
        {
          id: 'keep',
          byteSize: 50,
          lastShownAt: '2026-03-01T00:00:00.000Z',
          capturedAt: '2026-03-01T00:00:00.000Z'
        }
      ],
      'keep',
      { maxEntries: 10, maxBytes: 100 }
    )
    expect(victims).toEqual(['a', 'b'])
  })
})
