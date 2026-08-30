import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  resolveMemoryItemSavedAtIso,
  resolveMemoryItemSavedAtMs
} from '@/core/memory/memory-item-saved-at'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-08-01T00:00:00.000Z'
}

describe('memory-item-saved-at', () => {
  it('书签优先 chromeCreatedAt', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Example',
        url: 'https://example.com',
        chromeCreatedAt: '2026-07-20T08:00:00.000Z'
      }
    })

    expect(resolveMemoryItemSavedAtIso(item)).toBe('2026-07-20T08:00:00.000Z')
    expect(resolveMemoryItemSavedAtMs(item)).toBe(Date.parse('2026-07-20T08:00:00.000Z'))
  })

  it('摘录使用 createdAt', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'hello',
        sourceUrl: 'https://example.com',
        pageTitle: 'Page'
      }
    })
    item.updatedAt = '2026-08-29T12:00:00.000Z'

    expect(resolveMemoryItemSavedAtIso(item)).toBe(item.createdAt)
  })
})
