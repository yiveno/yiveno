import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { getMemoryItemOpenHref, tryParseNavigableUrl } from '@/core/recall/memory-open-href'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

const detailPageUrl = 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/detail.html'

describe('memory-open-href', () => {
  it('书签返回原 URL', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '留存', url: 'https://example.com/retention' }
    })
    expect(getMemoryItemOpenHref(item, { detailPageUrl })).toBe('https://example.com/retention')
  })

  it('摘录返回 detail.html?id=', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '关键段落',
        sourceUrl: 'https://notes.example.com/post',
        pageTitle: '笔记'
      }
    })
    const href = getMemoryItemOpenHref(item, { detailPageUrl })
    expect(href).toContain('/detail.html?id=')
    expect(href).toContain(item.id)
  })

  it('tryParseNavigableUrl 接受 http 与扩展详情页', () => {
    expect(tryParseNavigableUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(
      tryParseNavigableUrl(`${detailPageUrl}?id=11111111-1111-4111-8111-111111111111`)
    ).toContain('detail.html')
    expect(tryParseNavigableUrl('javascript:alert(1)')).toBeNull()
  })
})
