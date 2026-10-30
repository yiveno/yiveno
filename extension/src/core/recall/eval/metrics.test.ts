import { describe, expect, it } from 'vitest'

import {
  aggregateSlotAgreement,
  meanMrr,
  meanNdcgAtK,
  meanRecallAtK,
  meanSlotAgreement,
  mrrContribution,
  ndcgAtK,
  rankOfGold,
  recallAtK,
  SLOT_AGREEMENT_PROTOCOL,
  slotAgreement,
  stabilizeRankedIds,
  summarizeSlotAgreementForParseGold
} from '@/core/recall/eval/metrics'
import { diffParseGoldSlots } from '@/core/recall/eval/judge-parse-gold'
import type { ParseGoldSlots } from '@/core/recall/eval/parse-gold-cases'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

const emptyParsed = (): ParsedRecallClue => ({
  raw: 'x',
  contentTerms: [],
  confidence: 'low'
})

describe('stabilizeRankedIds / rankOfGold', () => {
  it('去重保留首次出现', () => {
    expect(stabilizeRankedIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('空列表与空 gold → null 位次', () => {
    expect(rankOfGold([], 'g')).toBeNull()
    expect(rankOfGold(['a'], '')).toBeNull()
  })

  it('重复目标取最先位（1-based）', () => {
    expect(rankOfGold(['x', 'g', 'y', 'g'], 'g')).toBe(2)
  })
})

describe('recallAtK', () => {
  it('空候选 → 未命中', () => {
    expect(recallAtK([], 'g', 5)).toEqual({ hit: false, rank: null, k: 5 })
  })

  it('目标缺失 → 未命中', () => {
    expect(recallAtK(['a', 'b'], 'g', 10).hit).toBe(false)
  })

  it('k≤0 → 永不命中（即便目标在列表）', () => {
    expect(recallAtK(['g'], 'g', 0).hit).toBe(false)
    expect(recallAtK(['g'], 'g', -3).hit).toBe(false)
  })

  it('并列/重复 id：按稳定序判断前 K', () => {
    // 稳定序 g 在第 2 位；K=1 未中，K=2 命中
    const ids = ['a', 'g', 'g', 'b']
    expect(recallAtK(ids, 'g', 1).hit).toBe(false)
    expect(recallAtK(ids, 'g', 2)).toEqual({ hit: true, rank: 2, k: 2 })
  })
})

describe('meanRecallAtK 分母', () => {
  const queries = [
    { rankedIds: ['g'], goldId: 'g' },
    { rankedIds: ['a'], goldId: 'g' },
    { rankedIds: [], goldId: 'g' }
  ]

  it('默认 include_miss_as_zero：分母=3，命中=1', () => {
    const report = meanRecallAtK(queries, 5)
    expect(report.denominator).toBe(3)
    expect(report.hitCount).toBe(1)
    expect(report.mean).toBeCloseTo(1 / 3)
  })

  it('exclude_miss：仅全列表含目标的查询进分母', () => {
    // 仅第一条全列表含 g；第二条/空列表 rank=null 排除
    const report = meanRecallAtK(queries, 5, { missPolicy: 'exclude_miss' })
    expect(report.denominator).toBe(1)
    expect(report.hitCount).toBe(1)
    expect(report.mean).toBe(1)
  })

  it('exclude_miss 且全部缺失 → mean=null，分母 0', () => {
    const report = meanRecallAtK([{ rankedIds: ['a'], goldId: 'g' }], 5, {
      missPolicy: 'exclude_miss'
    })
    expect(report.mean).toBeNull()
    expect(report.denominator).toBe(0)
  })
})

describe('mrr / ndcgAtK', () => {
  it('MRR 贡献：第 1/2/缺失', () => {
    expect(mrrContribution(['g'], 'g')).toBe(1)
    expect(mrrContribution(['a', 'g'], 'g')).toBeCloseTo(0.5)
    expect(mrrContribution([], 'g')).toBe(0)
  })

  it('meanMrr 默认把 miss 计 0', () => {
    const report = meanMrr([
      { rankedIds: ['g'], goldId: 'g' },
      { rankedIds: ['a'], goldId: 'g' }
    ])
    expect(report.denominator).toBe(2)
    expect(report.mean).toBeCloseTo(0.5)
  })

  it('nDCG@K：rank1=1，rank2=1/log2(3)，超出 K 或缺失=0', () => {
    expect(ndcgAtK(['g'], 'g', 5)).toBe(1)
    expect(ndcgAtK(['a', 'g'], 'g', 5)).toBeCloseTo(1 / Math.log2(3))
    expect(ndcgAtK(['a', 'b', 'g'], 'g', 2)).toBe(0)
    expect(ndcgAtK([], 'g', 5)).toBe(0)
    expect(ndcgAtK(['g'], 'g', 0)).toBe(0)
  })

  it('meanNdcgAtK exclude_miss 分母', () => {
    const report = meanNdcgAtK(
      [
        { rankedIds: ['g'], goldId: 'g' },
        { rankedIds: [], goldId: 'g' }
      ],
      5,
      { missPolicy: 'exclude_miss' }
    )
    expect(report.denominator).toBe(1)
    expect(report.mean).toBe(1)
  })
})

describe('slotAgreement', () => {
  it('无声明字段 → agreement=null（不进宏观分母）；正负均为 NA', () => {
    const result = slotAgreement(emptyParsed(), {})
    expect(result.checkedCount).toBe(0)
    expect(result.agreement).toBeNull()
    expect(result.positive.agreement).toBeNull()
    expect(result.negative.agreement).toBeNull()
    expect(result.fields.excludeContentTerms).toBeUndefined()
  })

  it('字段级通过/失败与宏观平均', () => {
    const parsed: ParsedRecallClue = {
      raw: 'yesterday poem',
      contentTerms: ['li', 'bai'],
      objectTypes: ['poem'],
      confidence: 'high',
      timeRange: {
        from: '2026-07-27T00:00:00.000Z',
        to: '2026-07-27T23:59:59.999Z',
        label: 'yesterday'
      }
    }
    const ok = slotAgreement(parsed, {
      timeLabel: 'yesterday',
      objectTypes: ['poem'],
      contentTermsMustInclude: ['li', 'bai'],
      contentTermsExact: true,
      confidence: 'high'
    })
    expect(ok.agreement).toBe(1)
    expect(ok.checkedCount).toBe(4)
    expect(ok.positive.agreement).toBe(1)
    expect(ok.negative.agreement).toBeNull()

    const partial = slotAgreement(parsed, {
      timeLabel: 'last_week',
      objectTypes: ['poem'],
      confidence: 'high'
    })
    expect(partial.passedCount).toBe(2)
    expect(partial.checkedCount).toBe(3)
    expect(partial.agreement).toBeCloseTo(2 / 3)

    const mean = meanSlotAgreement([ok, partial, slotAgreement(emptyParsed(), {})])
    expect(mean.denominator).toBe(2)
    expect(mean.mean).toBeCloseTo((1 + 2 / 3) / 2)
  })

  it('null 期望 = 必须缺失；contentTerms 排除', () => {
    const parsed: ParsedRecallClue = {
      raw: 'x',
      contentTerms: ['auth', 'like'],
      confidence: 'medium'
    }
    expect(
      slotAgreement(parsed, {
        timeLabel: null,
        objectTypes: null,
        contentTermsMustInclude: ['auth'],
        contentTermsMustExclude: ['like']
      }).fields.contentTerms
    ).toBe(false)

    expect(
      slotAgreement(
        { ...parsed, contentTerms: ['auth'] },
        {
          timeLabel: null,
          contentTermsMustInclude: ['auth'],
          contentTermsMustExclude: ['like']
        }
      ).agreement
    ).toBe(1)
  })

  it('exclude：未声明不进分母；Empty / 漏提 / 多提 / Exact 与 diffParseGoldSlots 同构', () => {
    const base: ParsedRecallClue = {
      raw: 'x',
      contentTerms: ['yellowstone', 'lodging'],
      confidence: 'high',
      excludeContentTerms: ['day-hike', 'packing', 'checklist']
    }

    expect(
      slotAgreement(base, {
        contentTermsMustInclude: ['yellowstone']
      }).fields.excludeContentTerms
    ).toBeUndefined()

    const emptyExpect: ParseGoldSlots = { excludeContentTermsEmpty: true }
    expect(slotAgreement(base, emptyExpect).fields.excludeContentTerms).toBe(false)
    expect(diffParseGoldSlots(base, emptyExpect).length).toBeGreaterThan(0)
    expect(
      slotAgreement({ ...base, excludeContentTerms: [] }, emptyExpect).fields.excludeContentTerms
    ).toBe(true)
    expect(diffParseGoldSlots({ ...base, excludeContentTerms: [] }, emptyExpect)).toEqual([])

    const includeExpect: ParseGoldSlots = {
      excludeContentTermsMustInclude: ['day-hike', 'packing', 'checklist']
    }
    // 漏提
    const missingOne = {
      ...base,
      excludeContentTerms: ['day-hike', 'packing']
    }
    expect(slotAgreement(missingOne, includeExpect).fields.excludeContentTerms).toBe(false)
    expect(diffParseGoldSlots(missingOne, includeExpect).some(s => s.includes('缺少'))).toBe(true)

    // 多提（Exact）
    const exactExpect: ParseGoldSlots = {
      excludeContentTermsMustInclude: ['day-hike', 'packing'],
      excludeContentTermsExact: true
    }
    expect(slotAgreement(base, exactExpect).fields.excludeContentTerms).toBe(false)
    expect(diffParseGoldSlots(base, exactExpect).some(s => s.includes('精确'))).toBe(true)
    expect(
      slotAgreement({ ...base, excludeContentTerms: ['day-hike', 'packing'] }, exactExpect).fields
        .excludeContentTerms
    ).toBe(true)

    // MustExclude 泄漏（共享主题进了排除槽）
    const bannedExpect: ParseGoldSlots = {
      excludeContentTermsMustInclude: ['day-hike', 'packing', 'checklist'],
      excludeContentTermsMustExclude: ['yellowstone']
    }
    const leaked = {
      ...base,
      excludeContentTerms: ['day-hike', 'packing', 'checklist', 'yellowstone']
    }
    expect(slotAgreement(leaked, bannedExpect).fields.excludeContentTerms).toBe(false)
    expect(slotAgreement(base, bannedExpect).fields.excludeContentTerms).toBe(true)
    expect(diffParseGoldSlots(base, bannedExpect)).toEqual([])
  })

  it('正负分列：负向失败不稀释进正向 mean；aggregate 含 per-field hit rate', () => {
    const parsedOk: ParsedRecallClue = {
      raw: 'a',
      contentTerms: ['privacy'],
      objectTypes: ['article'],
      confidence: 'high',
      excludeContentTerms: []
    }
    const parsedBadExclude: ParsedRecallClue = {
      raw: 'b',
      contentTerms: ['privacy'],
      objectTypes: ['article'],
      confidence: 'high',
      excludeContentTerms: ['oops']
    }

    const expectBoth: ParseGoldSlots = {
      objectTypes: ['article'],
      contentTermsMustInclude: ['privacy'],
      excludeContentTermsEmpty: true
    }

    const a = slotAgreement(parsedOk, expectBoth)
    const b = slotAgreement(parsedBadExclude, expectBoth)
    expect(a.positive.agreement).toBe(1)
    expect(a.negative.agreement).toBe(1)
    expect(b.positive.agreement).toBe(1)
    expect(b.negative.agreement).toBe(0)
    // overall 被负向拖累；正向桶仍为 1
    expect(b.agreement).toBeCloseTo(2 / 3)

    const onlyPositive = slotAgreement(parsedOk, {
      objectTypes: ['article'],
      contentTermsMustInclude: ['privacy']
    })
    expect(onlyPositive.negative.agreement).toBeNull()

    const agg = aggregateSlotAgreement([a, b, onlyPositive])
    expect(agg.protocol).toBe(SLOT_AGREEMENT_PROTOCOL)
    expect(agg.positive.denominator).toBe(3)
    expect(agg.positive.mean).toBe(1)
    expect(agg.negative.denominator).toBe(2)
    expect(agg.negative.mean).toBeCloseTo(0.5)
    expect(agg.negative.perFieldHitRate.excludeContentTerms).toEqual({
      declaredCount: 2,
      passedCount: 1,
      hitRate: 0.5
    })
    expect(agg.positive.perFieldHitRate.objectTypes?.hitRate).toBe(1)
    // 未出现字段不写入 → 读侧 NA
    expect(agg.positive.perFieldHitRate.timeLabel).toBeUndefined()
  })

  it('summarizeSlotAgreementForParseGold：缺 expect → 全 NA', () => {
    const summary = summarizeSlotAgreementForParseGold(
      [{ caseId: 'unknown', parsed: emptyParsed() }],
      new Map()
    )
    expect(summary.perCase[0]?.slotAgreement.agreement).toBeNull()
    expect(summary.aggregate.positive.mean).toBeNull()
    expect(summary.aggregate.negative.denominator).toBe(0)
  })
})
