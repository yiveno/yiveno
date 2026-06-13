import { describe, expect, it } from 'vitest'
import { buildBookmarkSearchKeywords } from '@/core/bookmark/bookmark-search-keywords'

describe('bookmark-search-keywords', () => {
  it('合并 keywords 与 retrievalKeywords 并去重', () => {
    const merged = buildBookmarkSearchKeywords({
      keywords: ['React', 'react'],
      retrievalKeywords: ['听歌', 'React']
    })

    expect(merged).toEqual(['react', '听歌'])
  })
})
