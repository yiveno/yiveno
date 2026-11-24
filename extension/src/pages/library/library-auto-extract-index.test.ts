import { describe, expect, it } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  buildAutoExtractUrlIndex,
  resolveAutoExtractEntryForUrl
} from '@/pages/library/library-auto-extract-index'

function excerpt(partial: {
  id: string
  sourceUrl: string
  origin?: 'user' | 'auto_extract'
}): MemoryItem {
  return {
    id: partial.id,
    ownerId: '11111111-1111-4111-8111-111111111111',
    sourceLocalProfileId: 'profile',
    type: 'text_excerpt',
    payload: {
      selectedText: 'summary',
      sourceUrl: partial.sourceUrl,
      pageTitle: 'Title',
      domain: 'example.com',
      ...(partial.origin ? { origin: partial.origin } : {})
    },
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0
    },
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    deletedAt: null
  }
}

describe('library-auto-extract-index', () => {
  it('只索引 auto_extract；用户摘录忽略', () => {
    const index = buildAutoExtractUrlIndex(
      [
        excerpt({ id: 'a', sourceUrl: 'https://example.com/a', origin: 'auto_extract' }),
        excerpt({ id: 'b', sourceUrl: 'https://example.com/b', origin: 'user' }),
        excerpt({ id: 'c', sourceUrl: 'https://example.com/c' })
      ],
      'chrome-extension://x/detail.html'
    )
    expect(index.size).toBe(1)
    expect(index.get('https://example.com/a')?.id).toBe('a')
    expect(resolveAutoExtractEntryForUrl(index, 'https://example.com/a/#hash')?.id).toBe('a')
    expect(resolveAutoExtractEntryForUrl(index, 'https://example.com/b')).toBeNull()
  })
})
