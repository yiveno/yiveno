import { describe, expect, it } from 'vitest'
import {
  filterFlatSearchResults,
  mergeHybridSearchResults
} from '@/application/query/search-result-filter'
import { mergeHybridSearchResults as mergeFromCore } from '@/core/query-engine/hybrid-merge'
import type { EnhancedSearchResult } from '@/core/query-engine'

function makeResult(
  id: string,
  title: string,
  url: string,
  score: number,
  matchedFields: string[] = ['title']
): EnhancedSearchResult {
  return {
    bookmark: {
      id,
      title,
      url,
      parentId: '0',
      titleLower: title.toLowerCase(),
      urlLower: url.toLowerCase()
    },
    score,
    pathString: title,
    matchedFields,
    highlights: {},
    relevanceFactors: {}
  }
}

describe('search-result-filter', () => {
  it('flexsearch 模式仅保留文本命中', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('1', '中国历史百科', 'https://history.example.com', 0.9),
        makeResult('2', '淘宝', 'https://www.taobao.com', 0.85, ['semantic'])
      ],
      '历史',
      'flexsearch'
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.bookmark.id).toBe('1')
  })

  it('hybrid 模式过滤低相关语义噪声', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('aliyun', '开年焕新，限时特惠', 'https://www.aliyun.com', 0.91, ['semantic']),
        makeResult('taobao', '淘宝', 'https://www.taobao.com', 0.84, ['semantic']),
        makeResult('landsend', "Women's Crepe", 'https://www.landsend.com', 0.83, ['semantic'])
      ],
      '阿里云',
      'hybrid'
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.bookmark.id).toBe('aliyun')
  })

  it('hybrid 模式文本命中在前、语义补位在后', () => {
    const merged = mergeHybridSearchResults(
      [makeResult('1', '中国历史百科', 'https://history.example.com', 0.9, ['title'])],
      [makeResult('2', '文明起源', 'https://civilization.example.com', 0.88, ['semantic'])]
    )

    const filtered = filterFlatSearchResults(merged, '历史', 'hybrid')

    expect(filtered.map(result => result.bookmark.id)).toEqual(['1', '2'])
  })

  it('mergeHybridSearchResults 双命中仅保留 FlexSearch 条目', () => {
    const flex = [makeResult('1', '中国历史', 'https://history.example.com', 0.9, ['title'])]
    const semantic = [
      makeResult('1', '中国历史', 'https://history.example.com', 0.95, ['semantic']),
      makeResult('2', '文明起源', 'https://civilization.example.com', 0.88, ['semantic'])
    ]

    const merged = mergeFromCore(flex, semantic)

    expect(merged).toHaveLength(2)
    expect(merged[0]?.bookmark.id).toBe('1')
    expect(merged[0]?.matchedFields).toEqual(['title'])
    expect(merged[1]?.bookmark.id).toBe('2')
  })
})
