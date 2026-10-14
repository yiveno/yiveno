import { describe, expect, it } from 'vitest'

import { selectMemoryItemsToPush } from '@/core/memory/select-memory-items-to-push'
import type { MemoryItem } from '@/core/memory/memory-item'

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function excerpt(id: string, updatedAt: string): MemoryItem {
  return {
    id,
    ownerId: owner,
    sourceLocalProfileId: owner,
    type: 'text_excerpt',
    payload: {
      selectedText: 'x',
      sourceUrl: 'https://example.com/p',
      pageTitle: 't',
      domain: 'example.com'
    },
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt
  }
}

function bookmark(id: string, updatedAt: string): MemoryItem {
  return {
    id,
    ownerId: owner,
    sourceLocalProfileId: owner,
    type: 'bookmark',
    payload: {
      title: 't',
      url: 'https://example.com/b',
      domain: 'example.com',
      chromeBookmarkId: '1'
    },
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt
  }
}

describe('selectMemoryItemsToPush', () => {
  it('无水位时只推送摘录（ADR-017）', () => {
    const items = [
      excerpt('11111111-1111-4111-8111-111111111111', '2026-02-01T00:00:00.000Z'),
      bookmark('22222222-2222-4222-8222-222222222222', '2026-02-03T00:00:00.000Z'),
      excerpt('33333333-3333-4333-8333-333333333333', '2026-02-02T00:00:00.000Z')
    ]
    expect(selectMemoryItemsToPush(items, undefined).map(i => i.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333'
    ])
  })

  it('只推送 updatedAt 新于水位的摘录', () => {
    const watermark = '2026-02-01T12:00:00.000Z'
    const items = [
      excerpt('11111111-1111-4111-8111-111111111111', '2026-02-01T00:00:00.000Z'),
      excerpt('22222222-2222-4222-8222-222222222222', '2026-02-01T12:00:00.000Z'),
      bookmark('44444444-4444-4444-8444-444444444444', '2026-02-01T13:00:00.000Z'),
      excerpt('33333333-3333-4333-8333-333333333333', '2026-02-01T12:00:01.000Z')
    ]
    const selected = selectMemoryItemsToPush(items, watermark)
    expect(selected.map(i => i.id)).toEqual(['33333333-3333-4333-8333-333333333333'])
  })
})
