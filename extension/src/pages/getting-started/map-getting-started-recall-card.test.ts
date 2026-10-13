import { describe, expect, it } from 'vitest'

import { testTranslateEn } from '@/core/i18n/test-translate-en'
import type { MemoryItem } from '@/core/memory/memory-item'
import { mapGettingStartedRecallCard } from '@/pages/getting-started/map-getting-started-recall-card'

const bookmark: MemoryItem = {
  id: '00000000-0000-4000-8000-000000000001',
  ownerId: '00000000-0000-4000-8000-0000000000aa',
  sourceLocalProfileId: '00000000-0000-4000-8000-0000000000bb',
  type: 'bookmark',
  clues: { keywords: [], entities: [], tags: [], openCount: 0, settledCount: 0, dismissCount: 0 },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  payload: {
    title: 'Why Personal Knowledge Systems Matter',
    url: 'https://example.com/pks',
    domain: 'example.com'
  }
}

describe('map-getting-started-recall-card', () => {
  it('映射标题、host、url', () => {
    const card = mapGettingStartedRecallCard(
      {
        item: bookmark,
        score: 1,
        matchedFields: ['title']
      },
      'That article about knowledge',
      testTranslateEn,
      'chrome-extension://x/detail.html'
    )
    expect(card.id).toBe(bookmark.id)
    expect(card.title).toContain('Knowledge')
    expect(card.host).toBe('example.com')
    expect(card.url).toContain('example.com')
  })
})
