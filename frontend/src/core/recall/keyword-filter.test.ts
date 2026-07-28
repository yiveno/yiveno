import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { recallByKeyword } from '@/core/recall/build-recall-result'
import {
  compactRecallText,
  computeBehaviorBoost,
  computeDismissPenalty,
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
  it('tokenizeRecallClue 保留整句、分词与无空格段首尾 2-gram', () => {
    expect(tokenizeRecallClue('留存 分析')).toEqual(
      expect.arrayContaining(['留存 分析', '留存', '分析'])
    )
    expect(tokenizeRecallClue('发版前要跑哪些检查')).toEqual(
      expect.arrayContaining(['检查', '发版'])
    )
    // ASCII 单字母过噪丢弃；汉字单字可检索
    expect(tokenizeRecallClue('a')).toEqual([])
    expect(tokenizeRecallClue('字')).toEqual(expect.arrayContaining(['字']))
  })

  it('汉字单字可命中标题子串（红 → 红井）', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '网页红井-联机对战平台',
        url: 'https://ra2web.com/'
      }
    })

    const result = recallByKeyword([bookmark], '红')
    expect(result.topPick?.item.id).toBe(bookmark.id)
    expect(tokenizeRecallClue('红')).toEqual(expect.arrayContaining(['红']))
  })

  it('compactRecallText 去掉空白以便跨空格命中', () => {
    expect(compactRecallText('Yiveno 产品')).toBe('yiveno产品')
  })

  it('scoreMemoryItem 支持去空白与轻量错别字', () => {
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Yiveno 产品文档 v4.0',
        url: 'https://docs.yiveno.com/product/v4'
      }
    })

    const match = scoreMemoryItem(bookmark, 'Yiveno产品文挡')
    expect(match.score).toBeGreaterThan(0)
    expect(match.matchedFields).toContain('title')
  })

  it('词面命中后叠加行为加权；无命中不加', () => {
    const cold = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno 产品文档', url: 'https://docs.yiveno.com/a' }
    })
    const hot = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno 设计原则', url: 'https://docs.yiveno.com/b' },
      clues: {
        openCount: 20,
        lastOpenedAt: '2026-07-24T10:00:00.000Z'
      }
    })

    const nowMs = Date.parse('2026-07-25T12:00:00.000Z')
    expect(computeBehaviorBoost(hot, { nowMs })).toBeGreaterThan(0)
    expect(computeBehaviorBoost(cold, { nowMs })).toBe(0)

    const ranked = filterMemoryItemsByKeyword([cold, hot], 'Yiveno', {
      minScore: 1,
      nowMs
    })
    expect(ranked[0]?.item.id).toBe(hot.id)

    expect(scoreMemoryItem(hot, '完全无关', { nowMs }).score).toBe(0)
  })

  it('否定反馈 dismissCount 降权；多次封顶', () => {
    const clean = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno 产品文档', url: 'https://docs.yiveno.com/clean' }
    })
    const dismissed = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno 产品文档', url: 'https://docs.yiveno.com/dismissed' },
      clues: { dismissCount: 3 }
    })
    const heavilyDismissed = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Yiveno 产品文档', url: 'https://docs.yiveno.com/heavy' },
      clues: { dismissCount: 99 }
    })

    expect(computeDismissPenalty(clean)).toBe(0)
    expect(computeDismissPenalty(dismissed)).toBeGreaterThan(0)
    expect(computeDismissPenalty(heavilyDismissed)).toBe(10)

    const cleanScore = scoreMemoryItem(clean, 'Yiveno').score
    const dismissedScore = scoreMemoryItem(dismissed, 'Yiveno').score
    expect(dismissedScore).toBeLessThan(cleanScore)
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
        payload: { title: 'Yiveno 产品文档', url: 'https://docs.yiveno.example/docs' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Yiveno 设计原则', url: 'https://design.other.example/design' }
      })
    ]

    const result = recallByKeyword(items, 'Yiveno')
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick).not.toBeNull()
    expect(result.alsoPossible.length).toBeGreaterThan(0)
  })

  it('主文含词压过仅上下文沾边（即使上下文项更新且常打开）', () => {
    const contextOnly = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '先后仍须次第',
        sourceUrl: 'https://www.gushiwen.cn/a',
        pageTitle: '古文',
        contextBefore: '红白相间'
      },
      clues: {
        openCount: 40,
        lastOpenedAt: '2026-07-24T18:00:00.000Z'
      },
      now: () => '2026-07-25T08:00:00.000Z'
    })
    const inSelected = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '深红白宜相',
        sourceUrl: 'https://www.gushiwen.cn/b',
        pageTitle: '古文'
      },
      now: () => '2026-07-10T08:00:00.000Z'
    })

    const ranked = filterMemoryItemsByKeyword([contextOnly, inSelected], '红白', {
      nowMs: Date.parse('2026-07-25T12:00:00.000Z')
    })
    expect(ranked[0]?.item.id).toBe(inSelected.id)
    expect(ranked[0]?.matchedFields).toContain('textExcerpt')
  })

  it('语言无关贴合度：起首+短密压过夹心（中/英）', () => {
    const embeddedZh = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '深红白宜相',
        sourceUrl: 'https://example.com/zh-mid',
        pageTitle: 'x'
      },
      now: () => '2026-07-20T08:00:00.000Z'
    })
    const prefixZh = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '红白宜',
        sourceUrl: 'https://example.com/zh-prefix',
        pageTitle: 'x'
      },
      now: () => '2026-07-01T08:00:00.000Z'
    })
    const embeddedEn = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'deep red white tone',
        sourceUrl: 'https://example.com/en-mid',
        pageTitle: 'x'
      },
      now: () => '2026-07-20T08:00:00.000Z'
    })
    const prefixEn = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'red white ok',
        sourceUrl: 'https://example.com/en-prefix',
        pageTitle: 'x'
      },
      now: () => '2026-07-01T08:00:00.000Z'
    })

    expect(filterMemoryItemsByKeyword([embeddedZh, prefixZh], '红白')[0]?.item.id).toBe(prefixZh.id)
    expect(filterMemoryItemsByKeyword([embeddedEn, prefixEn], 'red white')[0]?.item.id).toBe(
      prefixEn.id
    )
  })

  it('摘录出处页名命中记为 pageTitle 而非 title', () => {
    const excerpt = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '先后仍须次第',
        sourceUrl: 'https://www.gushiwen.cn/x',
        pageTitle: '古文岛-原古诗文网'
      }
    })

    const match = scoreMemoryItem(excerpt, '古诗')
    expect(match.matchedFields).toContain('pageTitle')
    expect(match.matchedFields).not.toContain('title')

    const result = recallByKeyword([excerpt], '古诗')
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(excerpt.id)
  })

  it('用户备注命中权重大于正文，可作强线索找回', () => {
    const byBody = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '红白相间的句子',
        sourceUrl: 'https://example.com/body',
        pageTitle: '诗句'
      }
    })
    const byNote = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '岷峨路远万重云',
        sourceUrl: 'https://example.com/note',
        pageTitle: '不如归去'
      },
      clues: { note: '红白印象' }
    })

    const ranked = filterMemoryItemsByKeyword([byBody, byNote], '红白')
    expect(ranked[0]?.item.id).toBe(byNote.id)
    expect(ranked[0]?.matchedFields).toContain('note')
  })
})
