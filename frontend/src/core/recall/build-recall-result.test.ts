import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import {
  FUZZY_VARIANT_SCORE_FACTOR,
  OMNIBOX_FUZZY_SKIP_IF_PRIMARY_COUNT,
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
      if (also.item.type === 'bookmark') {
        expect(also.item.payload.domain).not.toBe('ai-bot.cn')
        expect(also.item.payload.domain).not.toBe('www.ai-bot.cn')
      }
    }
  })

  it('同站其它 path 不并入 stacks N，也不进 Also', () => {
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
    expect(result.alsoPossible).toHaveLength(2)
    for (const also of result.alsoPossible) {
      expect(also.item.type).toBe('bookmark')
      if (also.item.type === 'bookmark') {
        expect(also.item.payload.domain).not.toBe('ai-bot.cn')
      }
    }
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

  it('Indexed Fuzzy：主路径已满额且头名够强时跳过变体扫（短路径）', () => {
    // recat≠react 子串/形态，避免主路径误命中 canon 标题
    const shortItems = Array.from({ length: OMNIBOX_FUZZY_SKIP_IF_PRIMARY_COUNT }, (_, i) =>
      createBookmarkMemoryItem({
        ...baseContext,
        payload: {
          title: `recat notes ${i}`,
          url: `https://example.com/recat-${i}`
        }
      })
    )
    const fuzzyOnly = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'React handbook deep dive',
        url: 'https://example.com/react-handbook'
      }
    })

    const sparse = filterKeywordMatchesBeforeCollapse(
      [...shortItems.slice(0, 2), fuzzyOnly],
      'recat',
      {
        minScore: 1,
        fuzzyExpandTokens: ['react'],
        behaviorProfile: 'omnibox'
      }
    )
    expect(sparse.some(m => m.item.id === fuzzyOnly.id)).toBe(true)

    const skipped = filterKeywordMatchesBeforeCollapse([...shortItems, fuzzyOnly], 'recat', {
      minScore: 1,
      fuzzyExpandTokens: ['react'],
      behaviorProfile: 'omnibox'
    })
    expect(skipped).toHaveLength(OMNIBOX_FUZZY_SKIP_IF_PRIMARY_COUNT)
    expect(skipped.every(m => shortItems.some(s => s.id === m.item.id))).toBe(true)
    expect(skipped.some(m => m.item.id === fuzzyOnly.id)).toBe(false)
  })

  it('Indexed Fuzzy：变体分折扣，精确标题不被扩词满分冲掉', () => {
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
      fuzzyExpandTokens: ['javascript'],
      behaviorProfile: 'omnibox'
    })
    merged.sort((a, b) => b.score - a.score)
    expect(merged[0]?.item.id).toBe(exactJs.id)

    const fuzzyOnly = merged.find(m => m.item.id === longCanon.id)
    expect(fuzzyOnly).toBeDefined()
    // 变体路径须带折扣（相对未折扣主路径满分）
    const undiscounted = filterKeywordMatchesBeforeCollapse([longCanon], 'javascript', {
      minScore: 1,
      behaviorProfile: 'omnibox'
    })[0]
    expect(undiscounted).toBeDefined()
    expect(fuzzyOnly!.score).toBeLessThanOrEqual(
      Math.floor(undiscounted!.score * FUZZY_VARIANT_SCORE_FACTOR)
    )
  })
})
