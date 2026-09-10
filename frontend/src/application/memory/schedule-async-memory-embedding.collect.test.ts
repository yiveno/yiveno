import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import { WORKER_EMBEDDING_MODEL } from '@/infrastructure/ai/embed-api-client'
import { collectMissingEmbeddingItemsForTests } from '@/application/memory/schedule-async-memory-embedding'
import type { MemoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

function bookmark(id: string, createdAt: string, withEmbed: boolean): MemoryItem {
  return {
    id,
    ownerId: 'local',
    type: 'bookmark',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    payload: {
      title: `T-${id}`,
      url: `https://example.com/${id}`,
      chromeBookmarkId: id
    },
    clues: withEmbed
      ? {
          embedding: [0.1, 0.2],
          embeddingModel: WORKER_EMBEDDING_MODEL,
          embeddingDim: 2
        }
      : {}
  } as MemoryItem
}

function excerpt(id: string, withEmbed: boolean): MemoryItem {
  return {
    id,
    ownerId: 'local',
    type: 'text_excerpt',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
    payload: {
      selectedText: 'hello world excerpt body',
      sourceUrl: 'https://example.com/e',
      pageTitle: 'E'
    },
    clues: withEmbed
      ? {
          embedding: [0.3],
          embeddingModel: WORKER_EMBEDDING_MODEL,
          embeddingDim: 1
        }
      : {}
  } as MemoryItem
}

describe('collectMissingEmbeddingItems', () => {
  const listByOwner = vi.fn()

  beforeEach(() => {
    listByOwner.mockReset()
  })

  it('摘录优先，书签按 createdAt 新→旧补满', async () => {
    const oldMissing = bookmark('old', '2026-09-01T00:00:00.000Z', false)
    const newMissing = bookmark('new', '2026-09-10T12:00:00.000Z', false)
    const withEmbed = bookmark('ok', '2026-09-10T13:00:00.000Z', true)
    const excerptMissing = excerpt('ex1', false)

    listByOwner.mockImplementation(async (options: { type?: string }) => {
      if (options.type === 'text_excerpt') {
        return [excerptMissing]
      }
      if (options.type === 'bookmark') {
        return [oldMissing, withEmbed, newMissing]
      }
      return []
    })

    const repository = { listByOwner } as unknown as MemoryItemRepository
    const result = await collectMissingEmbeddingItemsForTests(repository, 2)

    expect(result.excerptEnqueued).toBe(1)
    expect(result.missing.map(item => item.id)).toEqual(['ex1', 'new'])
  })
})
