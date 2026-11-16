/**
 * Phase 5：死链降权（打分层）契约。
 */

import { describe, expect, it } from 'vitest'

import { fuseKeywordAndSemanticPools } from '@/application/recall/backends/hybrid-recall-backend'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import {
  applyStalePenaltiesToMatches,
  computeStalePenalty,
  scoreMemoryItem,
  type RecallLinkStatusHint
} from '@/core/recall/keyword-filter'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch } from '@/core/recall/recall-result'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

const staleHint: RecallLinkStatusHint = {
  linkStatus: 'stale',
  consecutiveFailures: 2
}

/** 顶满 cap=10，便于断言「单次 ≤10 / 双扣会到 20」。 */
const staleHintAtCap: RecallLinkStatusHint = {
  linkStatus: 'stale',
  consecutiveFailures: 7
}

const emptyParsed = (): ParsedRecallClue => ({
  raw: 'rottnest',
  contentTerms: ['rottnest'],
  confidence: 'high'
})

describe('computeStalePenalty / D-5', () => {
  it('Omnibox 档位永远 0', () => {
    expect(computeStalePenalty(staleHint, 'omnibox')).toBe(0)
  })

  it('仅 stale 降权；ok/unknown 为 0', () => {
    expect(computeStalePenalty({ linkStatus: 'ok', consecutiveFailures: 0 })).toBe(0)
    expect(computeStalePenalty({ linkStatus: 'unknown', consecutiveFailures: 1 })).toBe(0)
    expect(computeStalePenalty(staleHint)).toBeGreaterThan(0)
  })
})

describe('死链只降权不过滤', () => {
  it('stale 条目仍可被召回（score>0），仅分数降低', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Rottnest Island ferry', url: 'https://example.com/rottnest' }
    })
    const base = scoreMemoryItem(item, 'rottnest')
    expect(base.score).toBeGreaterThan(0)

    const withStale = scoreMemoryItem(item, 'rottnest', {
      linkStatusByItemId: new Map([[item.id, staleHint]])
    })
    expect(withStale.score).toBeGreaterThan(0)
    expect(withStale.score).toBeLessThan(base.score)
  })

  it('降权不把候选从池中滤掉（applyStalePenaltiesToMatches 保长度）', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Quokka guide', url: 'https://example.com/quokka' }
    })
    const other = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Other', url: 'https://example.com/other' }
    })
    const matches: RecallMatch[] = [
      { item, score: 20, matchedFields: ['pageTitle'] },
      { item: other, score: 12, matchedFields: ['pageTitle'] }
    ]
    const next = applyStalePenaltiesToMatches(matches, new Map([[item.id, staleHint]]), 'default')
    expect(next).toHaveLength(2)
    expect(next[0]!.score).toBeLessThan(20)
    expect(next[0]!.score).toBeGreaterThan(0)
    // 不因降权变成「无候选」——constrained_none 判定仍看硬约束空，而非 stale 过滤
    expect(next.every(row => row.score >= 0)).toBe(true)
  })
})

describe('Hybrid fuse 不双扣 keyword 死链罚（F1）', () => {
  it('关键词命中 stale 项总罚分恰好一次 computeStalePenalty（≤10，非 20）', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Rottnest Island ferry', url: 'https://example.com/rottnest' }
    })
    const linkMap = new Map([[item.id, staleHintAtCap]])
    const expectedOnce = computeStalePenalty(staleHintAtCap, 'default')
    expect(expectedOnce).toBe(10)

    const unscored = scoreMemoryItem(item, 'rottnest')
    expect(unscored.score).toBeGreaterThan(expectedOnce)

    const keywordOnce = scoreMemoryItem(item, 'rottnest', { linkStatusByItemId: linkMap })
    const keywordPenalty = unscored.score - keywordOnce.score
    expect(keywordPenalty).toBe(expectedOnce)

    const keywordMatches: RecallMatch[] = [
      {
        item: keywordOnce.item,
        score: keywordOnce.score,
        matchedFields: keywordOnce.matchedFields
      }
    ]
    const fusedWithMap = fuseKeywordAndSemanticPools({
      keywordMatches,
      semanticMatches: [],
      parsed: emptyParsed(),
      pageContextMode: 'none',
      linkStatusByItemId: linkMap
    })
    const fusedControl = fuseKeywordAndSemanticPools({
      keywordMatches,
      semanticMatches: [],
      parsed: emptyParsed(),
      pageContextMode: 'none'
    })
    expect(fusedWithMap).toHaveLength(1)
    expect(fusedControl).toHaveLength(1)
    // fuse 不得再扣：有/无 linkStatus map 分数相同
    expect(fusedWithMap[0]!.score).toBe(fusedControl[0]!.score)
    // 相对「未扣死链」的 fuse 对照：总罚分 = 一次 cap，不是两次
    const fusedUnpenalizedKeyword: RecallMatch[] = [
      {
        item: unscored.item,
        score: unscored.score,
        matchedFields: unscored.matchedFields
      }
    ]
    const fusedAsIfNoKeywordPenalty = fuseKeywordAndSemanticPools({
      keywordMatches: fusedUnpenalizedKeyword,
      semanticMatches: [],
      parsed: emptyParsed(),
      pageContextMode: 'none'
    })
    const totalPenaltyVsUnpenalized = fusedAsIfNoKeywordPenalty[0]!.score - fusedWithMap[0]!.score
    expect(totalPenaltyVsUnpenalized).toBe(expectedOnce)
    expect(totalPenaltyVsUnpenalized).toBeLessThanOrEqual(10)
    expect(totalPenaltyVsUnpenalized).toBeLessThan(20)
  })
})
