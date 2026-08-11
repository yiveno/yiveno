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
  selectPostingCandidateIds,
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
        selectedText: 'empty-state tiers inside the retention analysis framework',
        sourceUrl: 'https://example.com/retention',
        pageTitle: 'Weekly notes',
        domain: 'example.com'
      }
    })
    const docTokens = new Set(extractDocumentIndexTokens(item))
    expect(docTokens.has('retention') || [...docTokens].some(t => t.includes('retention'))).toBe(
      true
    )
    const queryTokens = pickPostingLookupTokens('empty-state tiers')
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

  it('selectPostingCandidateIds 超 cap 时优先稀有 posting 命中', () => {
    const common = Array.from({ length: 20 }, (_, index) => `common-${index}`)
    const rare = ['rare-hit', 'rare-other']
    // 若按 common 先 FIFO 截断，rare-hit 会被挤掉；稀有度加权应保留
    const selected = selectPostingCandidateIds([common, rare], 5)
    expect(selected).toContain('rare-hit')
    expect(selected).toContain('rare-other')
    expect(selected.length).toBe(5)
  })

  it('selectPostingCandidateIds 未超 cap 返回全量', () => {
    expect(selectPostingCandidateIds([['a'], ['b', 'a']], 10).sort()).toEqual(['a', 'b'])
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
