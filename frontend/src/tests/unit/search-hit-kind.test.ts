import { describe, expect, it } from 'vitest'
import { isSemanticSupplementBookmark, isTextLayerSearchHit } from '@/core/filter/search-hit-kind'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

function makeBookmark(overrides: Partial<BookmarkRecord> = {}): BookmarkRecord {
  return {
    id: '1',
    title: 'QQ音乐',
    titleLower: 'qq音乐',
    url: 'https://y.qq.com',
    urlLower: 'https://y.qq.com',
    ...overrides
  } as BookmarkRecord
}

describe('search-hit-kind', () => {
  it('Flex 无命中时，语义通道子串命中提升为文本层', () => {
    const bookmark = makeBookmark()
    expect(isTextLayerSearchHit(bookmark, '音乐', ['semantic'], false)).toBe(true)
    expect(isSemanticSupplementBookmark(bookmark, '音乐', ['semantic'], false)).toBe(false)
  })

  it('Flex 有命中时语义通道子串命中不得进入文本层', () => {
    const bookmark = makeBookmark({
      title: 'v3.16.1',
      titleLower: 'v3.16.1',
      url: 'https://github.com/org/repo/releases/v3.16.1',
      urlLower: 'https://github.com/org/repo/releases/v3.16.1'
    })
    expect(isTextLayerSearchHit(bookmark, '1', ['semantic'], true)).toBe(false)
    expect(isSemanticSupplementBookmark(bookmark, '1', ['semantic'], true)).toBe(true)
  })

  it('文本未命中且 matchedFields 含 semantic 时归语义补位层', () => {
    const bookmark = makeBookmark({
      title: 'Reddit',
      titleLower: 'reddit',
      url: 'https://www.reddit.com',
      urlLower: 'https://www.reddit.com'
    })
    expect(isSemanticSupplementBookmark(bookmark, '音乐', ['semantic'], false)).toBe(true)
  })

  it('Flex 通道命中不归语义补位层', () => {
    const bookmark = makeBookmark({
      title: 'Reddit',
      titleLower: 'reddit'
    })
    expect(isSemanticSupplementBookmark(bookmark, '音乐', ['title'], true)).toBe(false)
  })
})
