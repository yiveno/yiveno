import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { MemoryItemSchema } from '@/core/memory/memory-item'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

describe('create-memory-item', () => {
  it('createBookmarkMemoryItem 生成合法 Bookmark MemoryItem', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Example',
        url: 'https://example.com/path'
      },
      captureEntry: 'popup'
    })

    expect(MemoryItemSchema.parse(item)).toEqual(item)
    expect(item.type).toBe('bookmark')
    expect(item.payload.domain).toBe('example.com')
    expect(item.clues.title).toBe('Example')
    expect(item.clues.captureEntry).toBe('popup')
    expect(item.deletedAt).toBeNull()
  })

  it('有 chromeCreatedAt 时 createdAt 用星标时间而非灌库时钟', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      now: () => '2026-07-28T12:00:00.000Z',
      payload: {
        title: 'Starred earlier',
        url: 'https://x.com/a/status/1',
        chromeCreatedAt: '2026-07-20T08:00:00.000Z'
      },
      captureEntry: 'sync'
    })
    expect(item.createdAt).toBe('2026-07-20T08:00:00.000Z')
    expect(item.payload.chromeCreatedAt).toBe('2026-07-20T08:00:00.000Z')
    expect(item.updatedAt).toBe('2026-07-28T12:00:00.000Z')
  })

  it('createTextExcerptMemoryItem 自动填充线索字段', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Key paragraph',
        sourceUrl: 'https://docs.example.com/page',
        pageTitle: 'Docs page'
      },
      captureEntry: 'context_menu'
    })

    expect(MemoryItemSchema.parse(item)).toEqual(item)
    expect(item.type).toBe('text_excerpt')
    expect(item.payload.domain).toBe('docs.example.com')
    expect(item.clues.textExcerpt).toBe('Key paragraph')
    expect(item.clues.title).toBe('Docs page')
  })
})
