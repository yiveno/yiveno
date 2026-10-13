import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  getMemoryItemOpenHref,
  getOmniboxSuggestContent,
  tryParseMemoryItemIdFromOpenHref,
  tryParseNavigableUrl,
  tryParseOmniboxOpenMemoryId
} from '@/core/recall/memory-open-href'

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
      payload: { title: 'Retention', url: 'https://example.com/retention' }
    })
    expect(getMemoryItemOpenHref(item, { detailPageUrl })).toBe('https://example.com/retention')
  })

  it('摘录返回 detail.html?id=', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Key paragraph',
        sourceUrl: 'https://notes.example.com/post',
        pageTitle: 'Notes'
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

  it('tryParseMemoryItemIdFromOpenHref 解析详情页与 Omnibox 占位 id', () => {
    expect(
      tryParseMemoryItemIdFromOpenHref(`${detailPageUrl}?id=11111111-1111-4111-8111-111111111111`)
    ).toBe('11111111-1111-4111-8111-111111111111')
    expect(tryParseMemoryItemIdFromOpenHref('https://example.com/a')).toBeNull()

    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Retention', url: 'https://example.com/retention' }
    })
    const omniboxContent = getOmniboxSuggestContent(bookmark, { detailPageUrl })
    expect(omniboxContent).toContain('/omnibox-open.html?id=')
    expect(tryParseOmniboxOpenMemoryId(omniboxContent)).toBe(bookmark.id)
    expect(tryParseMemoryItemIdFromOpenHref(omniboxContent)).toBe(bookmark.id)
  })

  it('摘录 Omnibox content 仍为详情页', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Key paragraph',
        sourceUrl: 'https://notes.example.com/post',
        pageTitle: 'Notes'
      }
    })
    expect(getOmniboxSuggestContent(item, { detailPageUrl })).toBe(
      getMemoryItemOpenHref(item, { detailPageUrl })
    )
  })
})
