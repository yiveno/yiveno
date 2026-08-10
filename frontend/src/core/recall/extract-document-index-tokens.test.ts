import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  extractDocumentIndexTokens,
  pickPostingLookupTokens,
  sameTokenSet,
  unionPostingItemIds,
  diffTokenSets
} from '@/core/recall/extract-document-index-tokens'

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sourceLocalProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('extract-document-index-tokens', () => {
  it('摘录正文产生可查 token，且查询侧能对上', () => {
    const item = createTextExcerptMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        selectedText: '留存分析框架里的空状态分层',
        sourceUrl: 'https://example.com/retention',
        pageTitle: '周记',
        domain: 'example.com'
      }
    })
    const docTokens = new Set(extractDocumentIndexTokens(item))
    expect(docTokens.has('留存') || [...docTokens].some(t => t.includes('留存'))).toBe(true)
    const queryTokens = pickPostingLookupTokens('空状态分层')
    expect(queryTokens.length).toBeGreaterThan(0)
    expect(queryTokens.some(token => docTokens.has(token))).toBe(true)
  })

  it('软删条目不产出 token', () => {
    const item = createBookmarkMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        title: 'Cloudflare Workers',
        url: 'https://developers.cloudflare.com/workers/',
        domain: 'developers.cloudflare.com'
      }
    })
    const deleted = { ...item, deletedAt: '2026-08-11T00:00:00.000Z' }
    expect(extractDocumentIndexTokens(deleted)).toEqual([])
  })

  it('unionPostingItemIds 保序去重', () => {
    expect(unionPostingItemIds([['a', 'b'], ['b', 'c'], ['a']])).toEqual(['a', 'b', 'c'])
  })

  it('sameTokenSet 忽略顺序', () => {
    expect(sameTokenSet(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameTokenSet(['a'], ['a', 'b'])).toBe(false)
  })

  it('diffTokenSets 计算增删', () => {
    expect(diffTokenSets(['a', 'b'], ['b', 'c'])).toEqual({
      added: ['c'],
      removed: ['a']
    })
  })
})
