import { describe, expect, it } from 'vitest'

import { selectMemoryItemsToPush } from '@/core/memory/select-memory-items-to-push'
import type { MemoryItem } from '@/core/memory/memory-item'

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function item(id: string, updatedAt: string): MemoryItem {
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
      dismissCount: 0
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt
  }
}

describe('selectMemoryItemsToPush', () => {
  it('无水位时推送全部', () => {
    const items = [
      item('11111111-1111-4111-8111-111111111111', '2026-02-01T00:00:00.000Z'),
      item('22222222-2222-4222-8222-222222222222', '2026-02-02T00:00:00.000Z')
    ]
    expect(selectMemoryItemsToPush(items, undefined)).toHaveLength(2)
  })

  it('只推送 updatedAt 新于水位的条目', () => {
    const watermark = '2026-02-01T12:00:00.000Z'
    const items = [
      item('11111111-1111-4111-8111-111111111111', '2026-02-01T00:00:00.000Z'),
      item('22222222-2222-4222-8222-222222222222', '2026-02-01T12:00:00.000Z'),
      item('33333333-3333-4333-8333-333333333333', '2026-02-01T12:00:01.000Z')
    ]
    const selected = selectMemoryItemsToPush(items, watermark)
    expect(selected.map(i => i.id)).toEqual(['33333333-3333-4333-8333-333333333333'])
  })
})
