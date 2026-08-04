import { describe, expect, test } from 'bun:test'

import { rowToMemoryItem, type MemoryItemRow } from './memory-items'

/** Supabase 常见 timestamptz：带偏移 + 非 3 位小数。 */
const SUPABASE_TS = '2026-07-31T08:49:15.57+00:00'

describe('rowToMemoryItem 时间戳归一化', () => {
  test('把 DB timestamptz 归一成 Zod datetime 可解析的 ISO', () => {
    const row: MemoryItemRow = {
      id: '11111111-1111-4111-8111-111111111111',
      owner_id: '22222222-2222-4222-8222-222222222222',
      source_local_profile_id: '33333333-3333-4333-8333-333333333333',
      type: 'bookmark',
      payload: {
        title: 'Example',
        url: 'https://example.com/',
        domain: 'example.com',
        chromeCreatedAt: SUPABASE_TS
      },
      clues: {
        keywords: [],
        entities: [],
        tags: [],
        openCount: 0,
        dismissCount: 0
      },
      created_at: SUPABASE_TS,
      updated_at: SUPABASE_TS,
      deleted_at: null,
      rev: 1
    }

    const item = rowToMemoryItem(row)
    expect(item.createdAt).toBe('2026-07-31T08:49:15.570Z')
    expect(item.updatedAt).toBe('2026-07-31T08:49:15.570Z')
    expect(item.type).toBe('bookmark')
    if (item.type === 'bookmark') {
      expect(item.payload.chromeCreatedAt).toBe('2026-07-31T08:49:15.570Z')
    }
  })
})
