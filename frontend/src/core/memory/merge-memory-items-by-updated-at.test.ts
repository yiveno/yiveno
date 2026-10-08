import { describe, expect, it } from 'vitest'

import { mergeMemoryItemsByUpdatedAt } from '@/core/memory/merge-memory-items-by-updated-at'
import type { MemoryItem } from '@/core/memory/memory-item'

const ownerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ownerB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function excerpt(id: string, ownerId: string, updatedAt: string, selectedText = 'x'): MemoryItem {
  return {
    id,
    ownerId,
    sourceLocalProfileId: ownerA,
    type: 'text_excerpt',
    payload: {
      selectedText,
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

describe('mergeMemoryItemsByUpdatedAt', () => {
  it('并集：只在一侧的都保留', () => {
    const idLocal = '11111111-1111-4111-8111-111111111111'
    const idRemote = '22222222-2222-4222-8222-222222222222'
    const merged = mergeMemoryItemsByUpdatedAt(
      [excerpt(idLocal, ownerA, '2026-02-01T00:00:00.000Z')],
      [excerpt(idRemote, ownerB, '2026-02-01T00:00:00.000Z')],
      ownerA
    )
    expect(merged).toHaveLength(2)
    expect(merged.every(item => item.ownerId === ownerA)).toBe(true)
    expect(new Set(merged.map(item => item.id))).toEqual(new Set([idLocal, idRemote]))
  })

  it('同 id：updatedAt 较新胜', () => {
    const id = '33333333-3333-4333-8333-333333333333'
    const merged = mergeMemoryItemsByUpdatedAt(
      [excerpt(id, ownerA, '2026-03-01T00:00:00.000Z', 'local-new')],
      [excerpt(id, ownerB, '2026-02-01T00:00:00.000Z', 'remote-old')],
      ownerA
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.payload).toMatchObject({ selectedText: 'local-new' })
  })

  it('同 id 且 updatedAt 相等：保留远程', () => {
    const id = '44444444-4444-4444-8444-444444444444'
    const same = '2026-02-01T00:00:00.000Z'
    const merged = mergeMemoryItemsByUpdatedAt(
      [excerpt(id, ownerA, same, 'local')],
      [excerpt(id, ownerB, same, 'remote')],
      ownerA
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.payload).toMatchObject({ selectedText: 'remote' })
  })
})
