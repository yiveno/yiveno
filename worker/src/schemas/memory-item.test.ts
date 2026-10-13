import { describe, expect, test } from 'bun:test'

import { MemoryItemSchema } from '../schemas/memory-item'

const baseItem = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  sourceLocalProfileId: '33333333-3333-4333-8333-333333333333',
  type: 'bookmark' as const,
  payload: {
    title: 'Example',
    url: 'https://example.com/',
    domain: 'example.com'
  },
  clues: {
    keywords: [],
    entities: [],
    tags: [],
    openCount: 0,
    dismissCount: 0
  },
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z'
}

describe('MemoryItemSchema（云同步入站）', () => {
  test('合法 bookmark 可通过', () => {
    const parsed = MemoryItemSchema.safeParse(baseItem)
    expect(parsed.success).toBe(true)
  })

  test('跨用户伪造可由调用方比对 ownerId', () => {
    const parsed = MemoryItemSchema.parse(baseItem)
    const tokenUserId = '44444444-4444-4444-8444-444444444444'
    expect(parsed.ownerId === tokenUserId).toBe(false)
  })
})
