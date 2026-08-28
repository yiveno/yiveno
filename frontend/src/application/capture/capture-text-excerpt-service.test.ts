import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/application/memory/schedule-async-memory-llm-enrichment', () => ({
  scheduleAsyncMemoryLlmEnrichment: vi.fn()
}))

vi.mock('@/application/memory/schedule-async-memory-embedding', () => ({
  scheduleAsyncMemoryEmbedding: vi.fn()
}))

import { captureTextExcerptFromContextMenu } from '@/application/capture/capture-text-excerpt-service'
import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

type StorageMap = Record<string, unknown>

function createChromeMock(initial: StorageMap = {}) {
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
    scripting: {
      executeScript: vi.fn(async () => [
        {
          result: {
            selectedText: 'key paragraph',
            contextBefore: 'before text',
            contextAfter: 'after text'
          }
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

describe('capture-text-excerpt-service', () => {
  beforeEach(async () => {
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('captureTextExcerptFromContextMenu 写入 Text Excerpt', async () => {
    const item = await captureTextExcerptFromContextMenu({
      selectionText: 'key paragraph',
      sourceUrl: 'https://example.com/article',
      pageTitle: 'Article page',
      tabId: 1
    })

    expect(item.type).toBe('text_excerpt')
    if (item.type === 'text_excerpt') {
      expect(item.payload.selectedText).toBe('key paragraph')
      expect(item.payload.contextBefore).toBe('before text')
      expect(item.payload.contextAfter).toBe('after text')
      expect(item.clues.captureEntry).toBe('context_menu')
    }
  })

  it('非 http(s) 页面拒绝保存', async () => {
    await expect(
      captureTextExcerptFromContextMenu({
        selectionText: 'test',
        sourceUrl: 'chrome://extensions',
        pageTitle: 'Extensions'
      })
    ).rejects.toThrow('CAPTURE_UNSAVABLE_PAGE')
  })
})
