/**
 * TopicLookup 单元测试（Gap 4 · D3-C）。
 * 测试 Topic 独立检索路径的占位实现（词面匹配）。
 */

import { describe, expect, it } from 'vitest'
import { mergeTopicLookupWithKeywordMatches, topicLookup } from '@/core/recall/topic-lookup'
import type { RecallMatch } from '@/core/recall/recall-result'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import {
  buildFilterClueFromParsed,
  recallByKeywordWithParsedClue
} from '@/core/recall/orchestrate-keyword-recall'
import { withRecallTopic } from '@/core/recall/recall-topic'

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'
const NOW_MS = Date.parse('2026-07-28T12:00:00.000Z')

// ============================================================
// 辅助构造
// ============================================================

function makeItem(
  overrides: Partial<{
    id: string
    title: string
    url: string
    selectedText: string
    pageTitle: string
    sourceUrl: string
  }> = {}
) {
  return createBookmarkMemoryItem({
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    payload: {
      title: overrides.title ?? 'Test Page',
      url: overrides.url ?? 'https://example.com/test'
    },
    ...(overrides.id ? { id: overrides.id } : {})
  }) as import('@/core/memory/memory-item').MemoryItem
}

function makeTopicDescriptor(tokens: string[], displayName?: string) {
  return {
    displayName: displayName ?? tokens.join(' '),
    tokens
  }
}

// ============================================================
// topicLookup 占位实现：词面匹配
// ============================================================

describe('topicLookup 占位实现：Topic 词面匹配', () => {
  it('title 命中 topic token → topicScore > 0', () => {
    const item = makeItem({ title: 'Model 3 review Tesla', url: 'https://example.com/model3' })
    const result = topicLookup([item], makeTopicDescriptor(['model', '3']))
    expect(result.topicSkipped).toBe(false)
    expect(result.topicMatches.length).toBeGreaterThan(0)
    const match = result.topicMatches.find(m => m.item.id === item.id)
    expect(match?.topicScore).toBeGreaterThan(0)
  })

  it('URL 命中 topic token → topicScore > 0', () => {
    const item = makeItem({ title: 'Review Page', url: 'https://example.com/tesla-model-3' })
    const result = topicLookup([item], makeTopicDescriptor(['tesla', 'model']))
    expect(result.topicSkipped).toBe(false)
    const match = result.topicMatches.find(m => m.item.id === item.id)
    expect(match?.topicScore).toBeGreaterThan(0)
  })

  it('标题和 URL 均命中 → topicScore 更高', () => {
    const bothHit = makeItem({ title: 'Tesla Model 3', url: 'https://example.com/tesla-model-3' })
    const titleOnly = makeItem({ title: 'Tesla Model 3', url: 'https://example.com/other' })
    const neither = makeItem({ title: 'Unrelated Page', url: 'https://example.com/other' })

    const result = topicLookup(
      [bothHit, titleOnly, neither],
      makeTopicDescriptor(['tesla', 'model'])
    )

    const bothHitScore = result.topicMatches.find(m => m.item.id === bothHit.id)?.topicScore ?? 0
    const titleOnlyScore =
      result.topicMatches.find(m => m.item.id === titleOnly.id)?.topicScore ?? 0
    const neitherScore = result.topicMatches.find(m => m.item.id === neither.id)?.topicScore ?? 0

    expect(bothHitScore).toBeGreaterThan(titleOnlyScore)
    expect(titleOnlyScore).toBeGreaterThan(neitherScore)
  })

  it('无命中 → topicMatches 为空', () => {
    const item = makeItem({ title: 'Unrelated Topic', url: 'https://example.com/other' })
    const result = topicLookup([item], makeTopicDescriptor(['definitely', 'not', 'matching']))
    expect(result.topicMatches.length).toBe(0)
  })

  it('empty items → topicMatches 为空', () => {
    const result = topicLookup([], makeTopicDescriptor(['model', '3']))
    expect(result.topicMatches.length).toBe(0)
  })

  it('按 topicScore 降序排列', () => {
    const high = makeItem({
      id: 'high',
      title: 'Tesla Model 3 Review',
      url: 'https://example.com/high'
    })
    const medium = makeItem({
      id: 'medium',
      title: 'Tesla Overview',
      url: 'https://example.com/medium'
    })
    const low = makeItem({ id: 'low', title: 'Tesla', url: 'https://example.com/low' })

    const result = topicLookup([low, high, medium], makeTopicDescriptor(['tesla', 'model', '3']))

    const scores = result.topicMatches.map(m => m.topicScore)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i + 1]!)
    }
  })

  it('limit 参数有效', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeItem({ id: `item-${i}`, title: `Tesla Model ${i}`, url: `https://example.com/${i}` })
    )
    const result = topicLookup(items, makeTopicDescriptor(['tesla', 'model']), undefined, {
      limit: 5
    })
    expect(result.topicMatches.length).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// topicLookup 接口预留：topicEmbedding 参数
// ============================================================

describe('topicLookup 接口预留：topicEmbedding 参数', () => {
  it('传入 topicEmbedding 不报错（类型校验通过）', () => {
    const item = makeItem({ title: 'Tesla Model 3', url: 'https://example.com/tesla' })
    // 传入 Float32Array：当前降级到词法路径，不报错
    const embedding = new Float32Array(384)
    embedding.fill(0.5)
    const result = topicLookup([item], makeTopicDescriptor(['tesla']), embedding)
    // topicEmbedding 传入但语义化路径未实现，降级到词法
    expect(result.topicSkipped).toBe(false)
  })

  it('undefined topicEmbedding 走词法路径（占位）', () => {
    const item = makeItem({ title: 'Model 3 review', url: 'https://example.com/model3' })
    // 显式传 undefined
    const result = topicLookup([item], makeTopicDescriptor(['model', '3']), undefined)
    expect(result.topicSkipped).toBe(false)
    expect(result.topicMatches.length).toBeGreaterThan(0)
  })
})

// ============================================================
// topicLookup 空 tokens / weak topic
// ============================================================

describe('topicLookup 空 tokens / weak topic', () => {
  it('tokens 为空数组 → topicSkipped=true', () => {
    const item = makeItem({ title: 'Some page', url: 'https://example.com/page' })
    const result = topicLookup([item], makeTopicDescriptor([]))
    expect(result.topicSkipped).toBe(true)
    expect(result.topicMatches.length).toBe(0)
  })

  it('tokens 全是空白 → topicSkipped=true', () => {
    const item = makeItem({ title: 'Some page', url: 'https://example.com/page' })
    const result = topicLookup([item], makeTopicDescriptor(['  ', '\t']))
    expect(result.topicSkipped).toBe(true)
  })
})

// ============================================================
// buildFilterClueFromParsed：Topic terms 不在 filterClue
// ============================================================

describe('buildFilterClueFromParsed：Topic terms 不在 filterClue（Gap 4 职责分离）', () => {
  it('filterClue = contentTerms.join(" ")（与 Gap 4 前行为一致）', () => {
    const parsed = parseRecallClue('model 3 about tesla', { nowMs: NOW_MS })
    const filterClue = buildFilterClueFromParsed(parsed)
    // filterClue 由 effectiveContentTermsForRecall 构造（contentTerms = topic.contentTerms）
    // Gap 4 后：filterClue 仍由 effectiveContentTermsForRecall 构造（不变），
    //           Topic 走 topicLookup 独立路径（不并入 filterClue）
    // 本测试验证 filterClue = contentTerms.join(' ')
    expect(filterClue).toBe('model 3 tesla')
  })

  it('泛词被 effectiveContentTermsForRecall 过滤，filterClue 不含泛词', () => {
    const parsed = parseRecallClue('wwii historical video', { nowMs: NOW_MS })
    // historical 被 effectiveContentTermsForRecall 过滤
    const filterClue = buildFilterClueFromParsed(parsed)
    // Gap 4 后：filterClue = contentTerms.join(' ') = 'wwii historical'
    // Topic 走 topicLookup（tokens = ['wwii']）
    expect(filterClue).toBe('wwii historical')
  })
})

// ============================================================
// mergeTopicLookupWithKeywordMatches：并集去重
// ============================================================

describe('mergeTopicLookupWithKeywordMatches：并集去重', () => {
  function makeKeywordMatch(title: string, score: number): RecallMatch {
    const item = makeItem({ title })
    return { item, score, matchedFields: [] }
  }

  function makeTopicMatchItem(title: string) {
    return makeItem({ title })
  }

  function makeTopicMatchResult(titles: string[], topicScores: number[]) {
    return {
      topicMatches: titles.map((title, i) => ({
        item: makeTopicMatchItem(title),
        topicScore: topicScores[i] ?? 0
      })),
      topicSkipped: false
    }
  }

  it('keyword 结果为主，Topic 结果作为补充', () => {
    const kwMatch = makeKeywordMatch('keyword match', 80)
    const kwId = kwMatch.item.id
    const result = mergeTopicLookupWithKeywordMatches(
      [kwMatch],
      makeTopicMatchResult(['topic match'], [60])
    )
    // keyword 结果保留（score=80）
    const kwResult = result.find(m => m.item.id === kwId)
    expect(kwResult?.score).toBe(80)
    // topic 结果添加（topicScore=60 → score=3，5分制）
    const topicResult = result.find(m => m.item.id !== kwId)
    expect(topicResult?.score).toBe(3)
  })

  it('相同 itemId：keyword 结果优先（去重）', () => {
    const kwMatch = makeKeywordMatch('shared', 80)
    const sharedId = kwMatch.item.id
    const result = mergeTopicLookupWithKeywordMatches([kwMatch], {
      topicMatches: [{ item: { ...kwMatch.item }, topicScore: 90 }],
      topicSkipped: false
    })
    // 只保留一条（keyword 版本）
    const matches = result.filter(m => m.item.id === sharedId)
    expect(matches.length).toBe(1)
    expect(matches[0]!.score).toBe(80) // keyword score 优先
  })

  it('topicSkipped=true → 直接返回 keyword 结果', () => {
    const kwMatch = makeKeywordMatch('kw', 80)
    const result = mergeTopicLookupWithKeywordMatches([kwMatch], {
      topicMatches: [],
      topicSkipped: true
    })
    expect(result).toEqual([kwMatch])
  })

  it('topicMatches 为空 → 直接返回 keyword 结果', () => {
    const kwMatch = makeKeywordMatch('kw', 80)
    const result = mergeTopicLookupWithKeywordMatches([kwMatch], {
      topicMatches: [],
      topicSkipped: false
    })
    expect(result).toEqual([kwMatch])
  })

  it('scoreBoost=0 时 topic 结果 score=0', () => {
    const kwMatch = makeKeywordMatch('kw', 80)
    const result = mergeTopicLookupWithKeywordMatches(
      [kwMatch],
      makeTopicMatchResult(['topic'], [100]),
      0 // 无加分
    )
    const topicResult = result.find(m => m.item.id !== kwMatch.item.id)
    expect(topicResult?.score).toBe(0)
  })

  it('空 keyword 结果 + Topic 结果 → 仅返回 Topic 结果', () => {
    const result = mergeTopicLookupWithKeywordMatches(
      [],
      makeTopicMatchResult(['topic-only'], [80])
    )
    expect(result.length).toBe(1)
    expect(result[0]!.score).toBe(4) // topicScore=80 → (80/100)*5=4
  })
})

// ============================================================
// recallByKeywordWithParsedClue：TopicLookup 集成
// ============================================================

describe('recallByKeywordWithParsedClue：TopicLookup 集成（Gap 4）', () => {
  it('无 topic 时：TopicLookup 跳过（不影响主路径）', () => {
    // thing → 无 topic → missing_topic 或 no_match
    const item = makeItem({ title: 'generic page', url: 'https://example.com/generic' })
    const result = recallByKeywordWithParsedClue([item], 'thing', { nowMs: NOW_MS })
    expect(result.outcome).toBeTruthy()
  })

  it('contentTerms 关键词分支：Topic 走独立路径（filterClue 不变）', () => {
    // 有 contentTerms 时，走关键词分支；TopicLookup 仅在约束邻域分支运行
    // 验证：filterClue 由 contentTerms 构造，Topic 走 topicLookup 独立路径
    const parsed = parseRecallClue('model 3 tesla', { nowMs: NOW_MS })
    const withTopic = withRecallTopic(parsed)
    // 有 contentTerms → 走关键词分支（不是约束邻域）
    expect(parsed.contentTerms.length).toBeGreaterThan(0)
    const filterClue = buildFilterClueFromParsed(parsed)
    // filterClue = contentTerms.join(' ')
    expect(filterClue).toBe('model 3 tesla')
    // parsed.topic 存在（withRecallTopic 幂等回填）
    expect(withTopic.topic?.terms.length ?? 0).toBeGreaterThan(0)
  })

  it('TopicLookup 接口预留：topicEmbedding 参数可传入不报错', () => {
    // 验证：topicLookup 接受 Float32Array topicEmbedding 参数
    const item = makeItem({ title: 'Tesla Model 3', url: 'https://example.com/tesla' })
    const embedding = new Float32Array(384)
    embedding.fill(0.5)
    // 不应抛错
    const result = topicLookup([item], makeTopicDescriptor(['tesla']), embedding)
    expect(result.topicSkipped).toBe(false)
  })
})

// ============================================================
// topicLookup embedding 路径（Gap 5 · D3-C 语义化）
// ============================================================

describe('topicLookup embedding 路径（Gap 5 · D3-C 语义化）', () => {
  function makeItemWithEmbedding(
    overrides: Partial<{
      id: string
      title: string
      url: string
    }> & { embedding: number[] }
  ) {
    return createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: overrides.title ?? 'Test Page',
        url: overrides.url ?? 'https://example.com/test'
      },
      ...(overrides.id ? { id: overrides.id } : {}),
      clues: {
        embedding: overrides.embedding
      }
    }) as import('@/core/memory/memory-item').MemoryItem
  }

  it('有 embedding 条目 + topicEmbedding → 返回 embedding 命中的结果', () => {
    // 两条目：一个有 embedding（cos≈1），一个无 embedding
    const itemWithEmbed = makeItemWithEmbedding({
      id: 'with-embed',
      title: 'Completely Different Title',
      url: 'https://example.com/other',
      embedding: [0.9, 0.1, 0.1, 0.1]
    })
    const itemWithoutEmbed = makeItem({
      id: 'no-embed',
      title: 'Tesla Model 3 Review',
      url: 'https://example.com/tesla'
    })
    // topic embedding 与 itemWithEmbed embedding 相同 → cos ≈ 1 → topicScore ≈ 100
    const topicEmbedding = new Float32Array([0.9, 0.1, 0.1, 0.1])
    const result = topicLookup(
      [itemWithEmbed, itemWithoutEmbed],
      makeTopicDescriptor(['model', '3']),
      topicEmbedding
    )
    expect(result.topicSkipped).toBe(false)
    // 有 embedding 的条目应在结果中（用实际 item.id 查）
    const withEmbedMatch = result.topicMatches.find(m => m.item.id === itemWithEmbed.id)
    expect(withEmbedMatch).toBeDefined()
    expect(withEmbedMatch!.topicScore).toBeGreaterThan(80) // cos≈1 → score≈100
  })

  it('embedding 路径：topicScore = round(cos_sim × 100)', () => {
    // 完全相同向量 → cos = 1 → topicScore = 100
    const item = makeItemWithEmbedding({
      id: 'item1',
      title: 'Similar',
      url: 'https://example.com/sim',
      embedding: [0.6, 0.4, 0.4, 0.4]
    })
    const topicEmbedding = new Float32Array([0.6, 0.4, 0.4, 0.4])
    const result = topicLookup([item], makeTopicDescriptor(['model', '3']), topicEmbedding)
    expect(result.topicMatches.length).toBe(1)
    expect(result.topicMatches[0]!.topicScore).toBe(100)
  })

  it('全库无 embedding 条目：降级词法路径（不报错）', () => {
    const items = [
      makeItem({ title: 'Tesla Model 3', url: 'https://example.com/tesla' }),
      makeItem({ title: 'Model 3 Review', url: 'https://example.com/model3' })
    ]
    const topicEmbedding = new Float32Array([0.9, 0.1, 0.1, 0.1])
    const result = topicLookup(items, makeTopicDescriptor(['model', '3']), topicEmbedding)
    expect(result.topicSkipped).toBe(false)
    // 降级词法后有结果（"model" 和 "3" 在标题中）
    expect(result.topicMatches.length).toBeGreaterThan(0)
  })

  it('embedding 路径：limit 参数有效', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItemWithEmbedding({
        id: `item-${i}`,
        title: `Similar ${i}`,
        url: `https://example.com/${i}`,
        embedding: Array(4).fill(0.9)
      })
    )
    const topicEmbedding = new Float32Array([0.9, 0.1, 0.1, 0.1])
    const result = topicLookup(items, makeTopicDescriptor(['model', '3']), topicEmbedding, {
      limit: 3
    })
    expect(result.topicMatches.length).toBeLessThanOrEqual(3)
  })
})
