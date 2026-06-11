import { describe, expect, it } from 'vitest'
import { isSemanticSupplementBookmark } from '@/core/filter/search-hit-kind'
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

describe('isSemanticSupplementBookmark', () => {
  it('标题含关键词时归文本层，即使 matchedFields 为 semantic', () => {
    const bookmark = makeBookmark()
    expect(isSemanticSupplementBookmark(bookmark, '音乐', ['semantic'])).toBe(false)
  })

  it('文本未命中且 matchedFields 含 semantic 时归语义补位层', () => {
    const bookmark = makeBookmark({
      title: 'Reddit',
      titleLower: 'reddit',
      url: 'https://www.reddit.com',
      urlLower: 'https://www.reddit.com'
    })
    expect(isSemanticSupplementBookmark(bookmark, '音乐', ['semantic'])).toBe(true)
  })

  it('文本未命中且无 semantic 标记时不归语义补位层', () => {
    const bookmark = makeBookmark({
      title: 'Reddit',
      titleLower: 'reddit'
    })
    expect(isSemanticSupplementBookmark(bookmark, '音乐', ['title'])).toBe(false)
  })
})
