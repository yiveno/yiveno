import { describe, expect, it } from 'vitest'

import { filterMemoryItemsBySourceScope } from '@/core/recall/recall-source-scope'

describe('filterMemoryItemsBySourceScope', () => {
  const items = [{ type: 'bookmark' as const }, { type: 'text_excerpt' as const }]

  it('all 保留两类', () => {
    expect(filterMemoryItemsBySourceScope(items, 'all')).toEqual(items)
    expect(filterMemoryItemsBySourceScope(items, undefined)).toEqual(items)
  })

  it('bookmark 只留书签', () => {
    expect(filterMemoryItemsBySourceScope(items, 'bookmark').map(item => item.type)).toEqual([
      'bookmark'
    ])
  })

  it('text_excerpt 只留摘录', () => {
    expect(filterMemoryItemsBySourceScope(items, 'text_excerpt').map(item => item.type)).toEqual([
      'text_excerpt'
    ])
  })
})
