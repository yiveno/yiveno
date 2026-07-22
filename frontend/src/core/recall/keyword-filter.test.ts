import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { recallByKeyword } from '@/core/recall/build-recall-result'
import {
  filterMemoryItemsByKeyword,
  scoreMemoryItem,
  tokenizeRecallClue
} from '@/core/recall/keyword-filter'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

describe('keyword-filter', () => {
  it('tokenizeRecallClue 保留整句与分词', () => {
    expect(tokenizeRecallClue('留存 分析')).toEqual(
      expect.arrayContaining(['留存 分析', '留存', '分析'])
    )
  })

  it('scoreMemoryItem 命中标题时分数更高', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '产品留存分析框架',
        url: 'https://example.com/retention'
      }
    })

    const match = scoreMemoryItem(bookmark, '留存分析')
    expect(match.score).toBeGreaterThan(0)
    expect(match.matchedFields).toContain('title')
  })

  it('filterMemoryItemsByKeyword 按分数排序并截断', () => {
    const items = [
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: '无关内容', url: 'https://a.example.com' }
      }),
      createTextExcerptMemoryItem({
        ...baseContext,
        payload: {
          selectedText: '关键留存指标说明',
          sourceUrl: 'https://b.example.com/post',
          pageTitle: '增长笔记'
        }
      })
    ]

    const matches = filterMemoryItemsByKeyword(items, '留存', { limit: 1, minScore: 1 })
    expect(matches).toHaveLength(1)
    expect(matches[0]?.item.type).toBe('text_excerpt')
  })

  it('recallByKeyword 无命中时返回 no_match', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Hello', url: 'https://hello.example.com' }
    })

    const result = recallByKeyword([bookmark], '完全无关')
    expect(result.outcome).toBe('no_match')
    expect(result.topPick).toBeNull()
  })

  it('recallByKeyword 返回 Top Pick 与候选', () => {
    const items = [
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Yiveno 产品文档', url: 'https://yiveno.com/docs' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Yiveno 设计原则', url: 'https://yiveno.com/design' }
      })
    ]

    const result = recallByKeyword(items, 'Yiveno')
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick).not.toBeNull()
    expect(result.alsoPossible.length).toBeGreaterThan(0)
  })
})
