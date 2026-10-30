import { describe, expect, it } from 'vitest'

import {
  applyRuleExcludeToContentTerms,
  filterMatchesByExcludeContentTerms,
  isUncertainNegationClue,
  itemHitsExcludeContentTerms,
  listExcludeTermsHittingItem,
  normalizeExcludeContentTerms,
  reconcilePositiveAndExcludeTerms
} from '@/core/recall/exclude-content-terms'
import { createTextExcerptMemoryItem } from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch } from '@/core/recall/recall-result'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'
import { ParsedRecallClueSchema } from '@/core/recall/parse-recall-clue-types'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'

function makeItem(id: string, pageTitle: string, selectedText: string): MemoryItem {
  return createTextExcerptMemoryItem({
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    now: () => '2026-07-25T12:00:00.000Z',
    payload: {
      selectedText,
      sourceUrl: `https://example.com/${id}`,
      pageTitle
    }
  })
}

function asMatch(item: MemoryItem, score = 10): RecallMatch {
  return { item, score, matchedFields: ['title'] }
}

describe('excludeContentTerms · 规范化与冲突', () => {
  it('剥否定标记与过泛词', () => {
    expect(normalizeExcludeContentTerms(['not', 'day', 'packing', 'checklist'])).toEqual([
      'packing',
      'checklist'
    ])
  })

  it('冲突：共享词保留正词、移出排除', () => {
    const result = reconcilePositiveAndExcludeTerms({
      contentTerms: ['yellowstone', 'lodging'],
      excludeContentTerms: ['yellowstone', 'packing']
    })
    expect(result.contentTerms).toContain('yellowstone')
    expect(result.excludeContentTerms).toEqual(['packing'])
  })
})

describe('excludeContentTerms · 规则降级', () => {
  it('意图 A：抽出 exclude，且 not 不进 contentTerms', () => {
    const clue =
      'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist'
    const parsed = parseRecallClue(clue)
    expect(parsed.contentTerms).not.toContain('not')
    expect(parsed.contentTerms).toEqual(
      expect.arrayContaining(['yellowstone', 'lodging', 'booking', 'confirmation', 'summer'])
    )
    expect(parsed.contentTerms).not.toContain('packing')
    expect(parsed.excludeContentTerms).toEqual(
      expect.arrayContaining(['day-hike', 'packing', 'checklist'])
    )
  })

  it('意图 B：无 exclude', () => {
    const parsed = parseRecallClue('the Yellowstone day-hike packing checklist I saved')
    expect(parsed.excludeContentTerms ?? []).toEqual([])
    expect(parsed.contentTerms).toEqual(
      expect.arrayContaining(['yellowstone', 'packing', 'checklist'])
    )
  })

  it('不确定表达：不抽 exclude', () => {
    expect(isUncertainNegationClue("I'm not sure which privacy article I meant")).toBe(true)
    const parsed = parseRecallClue("I'm not sure which privacy article I meant")
    expect(parsed.excludeContentTerms ?? []).toEqual([])
    expect(parsed.contentTerms).not.toContain('not')
  })

  it('无法识别范围：仅剥标记，不发明 exclude', () => {
    const applied = applyRuleExcludeToContentTerms('find lodging not packing somehow weirdly', [
      'lodging',
      'not',
      'packing',
      'somehow',
      'weirdly'
    ])
    // 「not packing」非保守表面（须 not the / except the 等）→ markers_only
    expect(applied.excludeContentTerms).toEqual([])
    expect(applied.contentTerms).not.toContain('not')
  })

  it('正负冲突：排除侧共享 yellowstone 不进 exclude', () => {
    const parsed = parseRecallClue(
      'yellowstone lodging confirmation, not the yellowstone day-hike packing checklist'
    )
    expect(parsed.contentTerms).toContain('yellowstone')
    expect(parsed.excludeContentTerms ?? []).not.toContain('yellowstone')
    expect(parsed.excludeContentTerms).toEqual(
      expect.arrayContaining(['day-hike', 'packing', 'checklist'])
    )
  })
})

describe('excludeContentTerms · LLM map 冲突消解', () => {
  it('proposal 双挂同词时正词胜出', () => {
    const mapped = mapLlmProposalToParsedClue(
      'yellowstone lodging, not the yellowstone packing checklist',
      {
        contentTerms: ['yellowstone', 'lodging'],
        excludeContentTerms: ['yellowstone', 'packing', 'checklist'],
        confidence: 'medium'
      },
      Date.now()
    )
    expect(mapped.contentTerms).toContain('yellowstone')
    expect(mapped.excludeContentTerms ?? []).not.toContain('yellowstone')
    expect(mapped.excludeContentTerms).toEqual(expect.arrayContaining(['packing', 'checklist']))
  })

  it('Zod schema 接受 excludeContentTerms', () => {
    const parsed = ParsedRecallClueSchema.parse({
      raw: 'x',
      contentTerms: ['lodging'],
      excludeContentTerms: ['packing'],
      confidence: 'low'
    })
    expect(parsed.excludeContentTerms).toEqual(['packing'])
  })
})

describe('excludeContentTerms · 硬过滤执行', () => {
  const lodging = makeItem(
    'lodging-1',
    'Yellowstone lodging booking confirmation',
    'Summer cabin reservation confirmation email'
  )
  const hiking = makeItem(
    'hike-1',
    'Yellowstone day-hike packing checklist',
    'Bear spray packing checklist for day hike'
  )

  it('硬过滤剔除命中排除词的候选', () => {
    const filtered = filterMatchesByExcludeContentTerms(
      [asMatch(lodging), asMatch(hiking)],
      ['packing', 'checklist', 'day-hike']
    )
    expect(filtered.map(match => match.item.id)).toEqual([lodging.id])
  })

  it('keyword 编排：意图 A 不返回 hiking；意图 B 命中 hiking', () => {
    const items = [lodging, hiking]
    const clueA =
      'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist'
    const intentA = recallByKeywordWithParsedClue(items, clueA, {
      parsed: parseRecallClue(clueA)
    })
    const rankedA = [
      ...(intentA.topPick ? [intentA.topPick.item.id] : []),
      ...intentA.alsoPossible.map(card => card.item.id)
    ]
    expect(rankedA).not.toContain(hiking.id)

    const clueB = 'the Yellowstone day-hike packing checklist I saved'
    const intentB = recallByKeywordWithParsedClue(items, clueB, {
      parsed: parseRecallClue(clueB)
    })
    const rankedB = [
      ...(intentB.topPick ? [intentB.topPick.item.id] : []),
      ...intentB.alsoPossible.map(card => card.item.id)
    ]
    expect(rankedB).toContain(hiking.id)
  })

  it('空池诚实：仅 hike 候选 + 排除约束 → no_match，不静默交还 hiking', () => {
    const clueA =
      'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist'
    const parsed = parseRecallClue(clueA)
    const result = recallByKeywordWithParsedClue([hiking], clueA, { parsed })
    expect(parsed.excludeContentTerms?.length).toBeGreaterThan(0)
    expect(result.outcome).toBe('no_match')
    expect(result.topPick).toBeNull()
    expect(result.alsoPossible).toEqual([])
  })

  it('匹配矩阵：hike / day-hike / hiking / hikers / packing 正反例', () => {
    const dayHikeSpaced = makeItem(
      'day-hike-spaced',
      'Yellowstone day hike guide',
      'A day hike without packing checklist'
    )
    const hikingTips = makeItem(
      'hiking-tips',
      'Yellowstone hiking tips',
      'Best hiking routes in the park'
    )
    const hikers = makeItem(
      'hikers-lodge',
      'Yellowstone lodging for hikers',
      'Cabin near trail for hikers only'
    )
    const ashike = makeItem('ashike', 'Ashike lodging booking', 'Random lodging note')

    // hike：命中 day-hike / day hike / hiking；不命中 hikers / Ashike / 纯 lodging
    expect(itemHitsExcludeContentTerms(hiking, ['hike'])).toBe(true)
    expect(itemHitsExcludeContentTerms(dayHikeSpaced, ['hike'])).toBe(true)
    expect(itemHitsExcludeContentTerms(hikingTips, ['hike'])).toBe(true)
    expect(itemHitsExcludeContentTerms(hikers, ['hike'])).toBe(false)
    expect(itemHitsExcludeContentTerms(ashike, ['hike'])).toBe(false)
    expect(itemHitsExcludeContentTerms(lodging, ['hike'])).toBe(false)

    // day-hike：连字符与空格对齐；不误杀 hikers-only
    expect(itemHitsExcludeContentTerms(hiking, ['day-hike'])).toBe(true)
    expect(itemHitsExcludeContentTerms(dayHikeSpaced, ['day-hike'])).toBe(true)
    expect(itemHitsExcludeContentTerms(hikers, ['day-hike'])).toBe(false)
    expect(itemHitsExcludeContentTerms(lodging, ['day-hike'])).toBe(false)

    // packing：词边界命中清单；纯 lodging 不中
    expect(itemHitsExcludeContentTerms(hiking, ['packing'])).toBe(true)
    expect(itemHitsExcludeContentTerms(lodging, ['packing'])).toBe(false)

    // LLM 生效集与规则集都能滤掉清单、放过 lodging
    expect(itemHitsExcludeContentTerms(hiking, ['hike', 'packing', 'checklist'])).toBe(true)
    expect(itemHitsExcludeContentTerms(lodging, ['hike', 'packing', 'checklist'])).toBe(false)
    expect(itemHitsExcludeContentTerms(hiking, ['day-hike', 'packing', 'checklist'])).toBe(true)
    expect(itemHitsExcludeContentTerms(hikers, ['hike', 'packing', 'checklist'])).toBe(false)
  })

  it('诊断：listExcludeTermsHittingItem 报告实际命中的排除词', () => {
    expect(listExcludeTermsHittingItem(hiking, ['day', 'hike', 'packing', 'checklist'])).toEqual([
      'hike',
      'packing',
      'checklist'
    ])
    expect(listExcludeTermsHittingItem(lodging, ['hike', 'packing', 'checklist'])).toEqual([])
  })

  it('行为否定不进 exclude；普通查询 / 不确定表达 exclude 空', () => {
    const half = parseRecallClue('the article I did not finish reading')
    expect(half.behaviorHints).toEqual(['half_read'])
    expect(half.excludeContentTerms ?? []).toEqual([])

    const plain = parseRecallClue('the privacy article from yesterday')
    expect(plain.excludeContentTerms ?? []).toEqual([])

    const uncertain = parseRecallClue("I'm not sure which privacy article I meant")
    expect(uncertain.excludeContentTerms ?? []).toEqual([])
  })

  it('Hybrid 降级同 parsed：keyword 路径仍硬过滤，不回灌 hiking', () => {
    // 生产 Hybrid 空池后走 finalizeKeywordResult → recallByKeywordWithParsedClue(同一 parsed)
    const clueA =
      'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist'
    const parsed = parseRecallClue(clueA)
    const llmLike = {
      ...parsed,
      excludeContentTerms: ['hike', 'packing', 'checklist']
    }
    const result = recallByKeywordWithParsedClue([lodging, hiking], clueA, {
      parsed: llmLike
    })
    const ranked = [
      ...(result.topPick ? [result.topPick.item.id] : []),
      ...result.alsoPossible.map(card => card.item.id)
    ]
    expect(ranked).toContain(lodging.id)
    expect(ranked).not.toContain(hiking.id)
    expect(llmLike.excludeContentTerms).toEqual(['hike', 'packing', 'checklist'])
  })
})
