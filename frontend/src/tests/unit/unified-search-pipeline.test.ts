import { describe, expect, it } from 'vitest'
import {
  collectBookmarkIdsFromSearchResults,
  finalizeBookmarkSearchResults
} from '@/application/query/unified-search-pipeline'
import type { EnhancedSearchResult } from '@/core/query-engine'

function makeResult(id: string, title: string, url: string): EnhancedSearchResult {
  return {
    bookmark: {
      id,
      title,
      url,
      parentId: '0',
      titleLower: title.toLowerCase(),
      urlLower: url.toLowerCase()
    },
    score: 1,
    pathString: title,
    matchedFields: ['title'],
    highlights: {},
    relevanceFactors: {}
  }
}

describe('unified-search-pipeline', () => {
  it('过滤无关命中并在空结果时走 IndexedDB 兜底', async () => {
    const filtered = await finalizeBookmarkSearchResults(
      '历史',
      [makeResult('1', '淘宝', 'https://www.taobao.com')],
      'flexsearch',
      10,
      async () => [
        {
          id: '2',
          score: 1,
          bookmark: {
            id: '2',
            title: '中国历史',
            url: 'https://history.example.com',
            parentId: '0',
            titleLower: '中国历史',
            urlLower: 'https://history.example.com'
          }
        }
      ]
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.bookmark.id).toBe('2')
  })

  it('collectBookmarkIdsFromSearchResults 仅收集书签叶子 ID', () => {
    const ids = collectBookmarkIdsFromSearchResults([
      makeResult('b1', 'Vue Docs', 'https://vuejs.org'),
      {
        ...makeResult('f1', '工作', ''),
        bookmark: {
          id: 'f1',
          title: '工作',
          parentId: '0'
        }
      }
    ])

    expect(Array.from(ids)).toEqual(['b1'])
  })
})
