import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetIndexedDbWriteQuotaExhaustedForTests } from '@/application/memory/indexeddb-write-quota'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { MemoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

const { invalidateBookmarkSyncAlignmentCacheMock } = vi.hoisted(() => ({
  invalidateBookmarkSyncAlignmentCacheMock: vi.fn()
}))

vi.mock('@/application/memory/bookmark-sync-alignment-cache-state', () => ({
  invalidateBookmarkSyncAlignmentCache: invalidateBookmarkSyncAlignmentCacheMock
}))

import { putEmbeddingWithQuotaRetryForTests } from '@/application/memory/schedule-async-memory-embedding'

function createQuotaError(): DOMException {
  return new DOMException('QuotaExceededError', 'QuotaExceededError')
}

describe('putEmbeddingWithQuotaRetry · 配额驱逐对齐缓存', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetIndexedDbWriteQuotaExhaustedForTests()
  })

  it('配额满 + 有可删 sync 书签 → 驱逐后 invalidate 恰一次', async () => {
    const nextItem = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: 'excerpt for embed',
        sourceUrl: 'https://example.com/a',
        pageTitle: 'A'
      },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    const victim = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        title: 'drop me',
        url: 'https://example.com/b',
        chromeBookmarkId: '99'
      },
      captureEntry: 'sync',
      now: () => '2026-07-22T05:00:00.000Z'
    })

    let putCalls = 0
    const putEnrichmentClues = vi.fn(async () => {
      putCalls += 1
      if (putCalls === 1) {
        throw createQuotaError()
      }
    })
    const hardDeleteMany = vi.fn(async (ids: string[]) => ids.length)
    const listByOwner = vi.fn(async () => [victim] as MemoryItem[])
    const repository = {
      putEnrichmentClues,
      listByOwner,
      hardDeleteMany
    } as unknown as MemoryItemRepository

    const result = await putEmbeddingWithQuotaRetryForTests(repository, nextItem)
    expect(result).toEqual({ ok: true })
    expect(hardDeleteMany).toHaveBeenCalledOnce()
    expect(invalidateBookmarkSyncAlignmentCacheMock).toHaveBeenCalledOnce()
    expect(putEnrichmentClues).toHaveBeenCalledTimes(2)
  })

  it('配额满 + 无可删行（dropped===0）→ invalidate 不被调', async () => {
    const nextItem = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: 'excerpt for embed',
        sourceUrl: 'https://example.com/a',
        pageTitle: 'A'
      },
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const putEnrichmentClues = vi.fn(async () => {
      throw createQuotaError()
    })
    const hardDeleteMany = vi.fn(async () => 0)
    const listByOwner = vi.fn(async () => [] as MemoryItem[])
    const repository = {
      putEnrichmentClues,
      listByOwner,
      hardDeleteMany
    } as unknown as MemoryItemRepository

    const result = await putEmbeddingWithQuotaRetryForTests(repository, nextItem)
    expect(result).toEqual({ ok: false, quota: true })
    expect(hardDeleteMany).not.toHaveBeenCalled()
    expect(invalidateBookmarkSyncAlignmentCacheMock).not.toHaveBeenCalled()
  })
})
