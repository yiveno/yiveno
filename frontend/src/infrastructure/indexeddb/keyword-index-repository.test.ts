import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { extractDocumentIndexTokens } from '@/core/recall/extract-document-index-tokens'
import { MEMORY_DATABASE_NAME } from '@/infrastructure/indexeddb/constants'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
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

describe('keyword-index-repository', () => {
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

  it('rebuild 后可按线索查出摘录 id', async () => {
    const item = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'env:sync:prod 上线检查清单',
        sourceUrl: 'https://docs.example.com/deploy',
        pageTitle: 'Deploy',
        domain: 'docs.example.com'
      },
      captureEntry: 'context_menu'
    })

    const rebuilt = await keywordIndexRepository.rebuildForOwner(item.ownerId)
    expect(rebuilt.itemCount).toBe(1)
    expect(rebuilt.postingCount).toBeGreaterThan(0)

    const meta = await keywordIndexRepository.getMeta(item.ownerId)
    expect(meta?.dirty).toBe(false)

    const lookup = await keywordIndexRepository.lookupCandidateIds('env:sync:prod', item.ownerId)
    expect(lookup).not.toBeNull()
    expect(lookup!.ids).toContain(item.id)
    expect(lookup!.rebuilt).toBe(false)
  })

  it('健康索引下 applyItemTokenDiff 增量可查新词、旧词可消失', async () => {
    const created = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: '第一版正文只有苹果味道',
        sourceUrl: 'https://example.com/a',
        pageTitle: 'A',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    await keywordIndexRepository.rebuildForOwner(created.ownerId)

    const updated = {
      ...created,
      payload: {
        ...created.payload,
        selectedText: '第二版正文换成香蕉味道'
      },
      clues: {
        ...created.clues,
        textExcerpt: '第二版正文换成香蕉味道'
      }
    }

    const applied = await keywordIndexRepository.applyItemTokenDiff({
      ownerId: created.ownerId,
      itemId: created.id,
      previousTokens: extractDocumentIndexTokens(created),
      nextTokens: extractDocumentIndexTokens(updated)
    })
    expect(applied.applied).toBe(true)
    expect(await keywordIndexRepository.isHealthy(created.ownerId)).toBe(true)

    const banana = await keywordIndexRepository.lookupCandidateIds('香蕉', created.ownerId)
    expect(banana?.ids).toContain(created.id)

    const apple = await keywordIndexRepository.lookupCandidateIds('苹果', created.ownerId)
    // 苹果若仍在其它字段（无）则不应含该 id；允许 posting 空列表导致 ids 不含
    expect(apple?.ids.includes(created.id) ?? false).toBe(false)
  })

  it('索引不健康时 applyItemTokenDiff 返回 applied=false', async () => {
    const created = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: '未重建的条目',
        sourceUrl: 'https://example.com/b',
        pageTitle: 'B',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    // createTextExcerpt → put → markDirty（索引未健康）
    const applied = await keywordIndexRepository.applyItemTokenDiff({
      ownerId: created.ownerId,
      itemId: created.id,
      previousTokens: [],
      nextTokens: extractDocumentIndexTokens(created)
    })
    expect(applied.applied).toBe(false)
  })

  it('DB 名仍为 YivenoMemoryDB', () => {
    expect(MEMORY_DATABASE_NAME).toBe('YivenoMemoryDB')
  })
})
