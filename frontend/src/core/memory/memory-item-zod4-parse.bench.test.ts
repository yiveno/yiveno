/**
 * Zod 4 热路径解析耗时对照（MemoryItem）。
 * 不作为 CI 硬门槛：只保证 2k 次 parse 在宽松上限内，防止解析路径明显退化。
 */

import { describe, expect, it } from 'vitest'
import { MemoryItemSchema } from '@/core/memory/memory-item'

const SAMPLE = {
  id: '22222222-2222-4222-8222-222222222222',
  ownerId: '33333333-3333-4333-8333-333333333333',
  sourceLocalProfileId: '44444444-4444-4444-8444-444444444444',
  type: 'bookmark' as const,
  clues: {
    title: 'Example',
    keywords: ['demo'],
    entities: [],
    tags: [],
    openCount: 0,
    settledCount: 0,
    dismissCount: 0,
    sourceUrl: 'https://example.com/page',
    domain: 'example.com'
  },
  payload: {
    title: 'Example',
    url: 'https://example.com/page',
    domain: 'example.com'
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('MemoryItemSchema Zod4 parse 热路径', () => {
  it('单次 parse 成功', () => {
    const parsed = MemoryItemSchema.safeParse(SAMPLE)
    expect(parsed.success).toBe(true)
  })

  it('2k 次 safeParse 应在 500ms 内（宽松防退化）', () => {
    const rounds = 2000
    const started = performance.now()
    for (let i = 0; i < rounds; i++) {
      const parsed = MemoryItemSchema.safeParse(SAMPLE)
      if (!parsed.success) {
        throw new Error('unexpected parse failure')
      }
    }
    const elapsedMs = performance.now() - started
    // 本机通常远低于此；上限只拦数量级回退
    expect(elapsedMs).toBeLessThan(500)
  })
})
