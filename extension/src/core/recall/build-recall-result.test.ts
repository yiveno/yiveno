import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import {
  RECALL_RESULT_POOL_LIMIT,
  buildRankedRecallPool,
  buildRecallResult,
  filterKeywordMatchesBeforeCollapse,
  recallByKeyword
} from '@/core/recall/build-recall-result'
import {
  getRecallDuplicateKey,
  serializeRecallDuplicateKey
} from '@/core/recall/collapse-recall-duplicates'
import { RECALL_TOP_PICK_MIN_SCORE } from '@/core/recall/keyword-filter'
import type { RecallMatch } from '@/core/recall/recall-result'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

describe('build-recall-result Top/Also 互斥', () => {
  it('buildRecallResult：top 与 also 下标不相交', () => {
    const matches: RecallMatch[] = [0, 1, 2].map(i => {
      const item = createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: `项${i}`, url: `https://site-${i}.example/${i}` }
      })
      return { item, score: 40 - i, matchedFields: ['title'] }
    })
    const result = buildRecallResult('项', matches)
    expect(result.topPick?.item.id).toBe(matches[0]?.item.id)
    expect(result.alsoPossible.map(m => m.item.id)).toEqual([
      matches[1]?.item.id,
      matches[2]?.item.id
    ])
    expect(result.alsoPossible.some(m => m.item.id === result.topPick?.item.id)).toBe(false)
    expect(result.totalRankedCount).toBe(3)
  })

  it('分数未达 Top Pick 阈值时为 need_a_clue，无 topPick、弱候选进 alsoPossible', () => {
    const matches: RecallMatch[] = [0, 1].map(i => {
      const item = createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: `弱命中${i}`, url: `https://weak-${i}.example/${i}` }
      })
      return {
        item,
        score: RECALL_TOP_PICK_MIN_SCORE - 1 - i,
        matchedFields: ['title'] as const
      }
    })
    const result = buildRecallResult('弱', matches)
    expect(result.outcome).toBe('need_a_clue')
    expect(result.topPick).toBeNull()
    expect(result.alsoPossible.map(m => m.item.id)).toEqual([
      matches[0]?.item.id,
      matches[1]?.item.id
    ])
    expect(result.totalRankedCount).toBe(2)
  })

  it('排序池可超过首屏 PAGE_SIZE，totalRankedCount 反映全池', () => {
    const matches: RecallMatch[] = Array.from({ length: 12 }, (_, i) => {
      const item = createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: `池${i}`, url: `https://pool-${i}.example/${i}` }
      })
      return { item, score: 40 - i, matchedFields: ['title'] }
    })
    const result = buildRecallResult('池', matches)
    expect(result.outcome).toBe('top_pick')
    expect(result.totalRankedCount).toBe(12)
    expect(result.alsoPossible).toHaveLength(11)
  })

  it('stacks N=同 URL 重复数（含写法差异），不是全部含 AI 的命中', () => {
    const items = [
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI工具集官网 1', url: 'https://ai-bot.cn/' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI工具集官网 2', url: 'https://ai-bot.cn' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI工具集官网 3', url: 'https://www.ai-bot.cn/' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI工具集官网 4', url: 'https://ai-bot.cn/' }
      }),
      ...Array.from({ length: 6 }, (_, i) =>
        createBookmarkMemoryItem({
          ...baseContext,
          payload: {
            title: `AI 其它 ${i}`,
            url: `https://other-${i}.example/ai`
          }
        })
      )
    ]

    const result = recallByKeyword(items, 'AI')
    expect(result.outcome).toBe('top_pick')
    const topDomain = result.topPick?.item.payload.domain
    expect(['ai-bot.cn', 'www.ai-bot.cn']).toContain(topDomain)
    expect(result.topPick?.duplicateGroup?.totalCount).toBe(4)
    expect(result.topPick?.duplicateGroup?.siblings).toHaveLength(3)

    const topKey = result.topPick
      ? serializeRecallDuplicateKey(getRecallDuplicateKey(result.topPick.item))
      : null
    for (const also of result.alsoPossible) {
      expect(serializeRecallDuplicateKey(getRecallDuplicateKey(also.item))).not.toBe(topKey)
    }
  })

  it('同站其它 path 不并入 stacks N，但可进 Also', () => {
    const items = [
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI工具集官网', url: 'https://ai-bot.cn/' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI工具集官网 副本', url: 'https://ai-bot.cn/' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI工具集官网 深页', url: 'https://ai-bot.cn/tools' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI 其它站点 A', url: 'https://tools.example/a' }
      }),
      createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'AI 其它站点 B', url: 'https://third.example/ai' }
      })
    ]

    const result = recallByKeyword(items, 'AI')
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.duplicateGroup?.totalCount).toBe(2)
    expect(result.alsoPossible).toHaveLength(3)
    const alsoTitles = result.alsoPossible.map(m =>
      m.item.type === 'bookmark' ? m.item.payload.title : ''
    )
    expect(alsoTitles).toContain('AI工具集官网 深页')
  })

  it('同域名书签排在融合序第 2 位时进入 alsoPossible', () => {
    const top = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '站首页', url: 'https://docs.example/' }
    })
    const sameDomainSecond = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '站深页', url: 'https://docs.example/guide' }
    })
    const other = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '外站', url: 'https://other.example/a' }
    })
    const matches: RecallMatch[] = [
      { item: top, score: 40, matchedFields: ['title'] },
      { item: sameDomainSecond, score: 35, matchedFields: ['title'] },
      { item: other, score: 30, matchedFields: ['title'] }
    ]
    const result = buildRecallResult('站', matches)
    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(top.id)
    expect(result.alsoPossible.map(m => m.item.id)).toEqual([sameDomainSecond.id, other.id])
  })

  it('同折叠键候选经 buildRankedRecallPool 仍被互斥', () => {
    const a = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '同 URL A', url: 'https://same.example/path' }
    })
    const b = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '同 URL B', url: 'https://same.example/path' }
    })
    const c = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '其它', url: 'https://else.example/x' }
    })
    expect(serializeRecallDuplicateKey(getRecallDuplicateKey(a))).toBe(
      serializeRecallDuplicateKey(getRecallDuplicateKey(b))
    )
    const pool = buildRankedRecallPool(
      [
        { item: a, score: 40, matchedFields: ['title'] },
        { item: b, score: 35, matchedFields: ['title'] },
        { item: c, score: 30, matchedFields: ['title'] }
      ],
      { withTopConflictFilter: true }
    )
    expect(pool.map(m => m.item.id)).toEqual([a.id, c.id])
  })

  it('need_a_clue 路径 withTopConflictFilter=false：同键候选仍按序截取进池', () => {
    const a = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '弱同键 A', url: 'https://weak-same.example/p' }
    })
    const b = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '弱同键 B', url: 'https://weak-same.example/p' }
    })
    const matches: RecallMatch[] = [
      { item: a, score: RECALL_TOP_PICK_MIN_SCORE - 2, matchedFields: ['title'] },
      { item: b, score: RECALL_TOP_PICK_MIN_SCORE - 3, matchedFields: ['title'] }
    ]
    const result = buildRecallResult('弱同键', matches)
    expect(result.outcome).toBe('need_a_clue')
    expect(result.topPick).toBeNull()
    // need_a_clue 不做同键互斥，按序保留（折叠前若已去重则另论；此处直接传两组）
    expect(result.alsoPossible.map(m => m.item.id)).toEqual([a.id, b.id])

    const poolNoFilter = buildRankedRecallPool(matches, { withTopConflictFilter: false })
    expect(poolNoFilter.map(m => m.item.id)).toEqual([a.id, b.id])
  })

  it(`池上限仍为 RECALL_RESULT_POOL_LIMIT=${RECALL_RESULT_POOL_LIMIT}，超限截断`, () => {
    const matches: RecallMatch[] = Array.from({ length: RECALL_RESULT_POOL_LIMIT + 10 }, (_, i) => {
      const item = createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: `截断${i}`, url: `https://cap-${i}.example/${i}` }
      })
      return { item, score: 40, matchedFields: ['title'] }
    })
    const withFilter = buildRankedRecallPool(matches, { withTopConflictFilter: true })
    const withoutFilter = buildRankedRecallPool(matches, { withTopConflictFilter: false })
    expect(withFilter).toHaveLength(RECALL_RESULT_POOL_LIMIT)
    expect(withoutFilter).toHaveLength(RECALL_RESULT_POOL_LIMIT)
    const result = buildRecallResult('截断', matches)
    expect(result.totalRankedCount).toBe(RECALL_RESULT_POOL_LIMIT)
  })

  it('大量同 URL 重复书签不得在折叠前挤掉其它互异组（js→JavaScript）', () => {
    // 复现：499+ js-cookie 占满旧 FETCH_LIMIT=500，挡住「现代 JavaScript 教程」
    const cookieFlood = Array.from({ length: 520 }, (_, i) =>
      createBookmarkMemoryItem({
        ...baseContext,
        now: () => `2026-07-22T06:00:${String(i % 60).padStart(2, '0')}.000Z`,
        payload: {
          title: 'js-cookie - npm',
          url: 'https://www.npmjs.com/package/js-cookie'
        }
      })
    )
    const jsTutorial = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: '现代 JavaScript 教程',
        url: 'https://zh.javascript.info/'
      }
    })
    const result = recallByKeyword([...cookieFlood, jsTutorial], 'js')
    expect(result.outcome).toBe('top_pick')
    const rankedTitles = [...(result.topPick ? [result.topPick] : []), ...result.alsoPossible].map(
      m => (m.item.type === 'bookmark' ? m.item.payload.title : m.item.clues.title)
    )
    expect(rankedTitles).toContain('现代 JavaScript 教程')
    expect(rankedTitles).toContain('js-cookie - npm')
    expect(result.totalRankedCount).toBeGreaterThanOrEqual(2)
    const cookie = [...(result.topPick ? [result.topPick] : []), ...result.alsoPossible].find(
      m => m.item.type === 'bookmark' && m.item.payload.title === 'js-cookie - npm'
    )
    expect(cookie?.duplicateGroup?.totalCount).toBe(520)
  })

  it('查询侧无静态缩写扩词：js 不凭字典命中仅含 JavaScript 的标题', () => {
    const exactJs = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'js cheat sheet', url: 'https://example.com/js-cheat' }
    })
    const longCanon = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'JavaScript language handbook deep dive',
        url: 'https://example.com/javascript-handbook'
      }
    })

    const merged = filterKeywordMatchesBeforeCollapse([exactJs, longCanon], 'js', {
      minScore: 1,
      behaviorProfile: 'omnibox'
    })
    expect(merged.some(m => m.item.id === exactJs.id)).toBe(true)
    // 无 js→javascript 字典时，仅靠形态：文档侧有 JavaScript→js 才可能命中；本条仅测不靠字典满分冲榜
    expect(merged[0]?.item.id).toBe(exactJs.id)
  })
})
