import { describe, expect, it } from 'vitest'

import { createTextExcerptMemoryItem } from '@/core/memory/create-memory-item'
import { filterMatchesByExcludeContentTerms } from '@/core/recall/exclude-content-terms'
import { RETRIEVAL_ABLATION_CASES } from '@/core/recall/eval/retrieval-ablation-cases'
import {
  assertAblationCorpusHasNoEmbeddings,
  buildRetrievalAblationCorpus,
  RETRIEVAL_ABLATION_NOW_MS
} from '@/core/recall/eval/retrieval-ablation-corpus'
import { RETRIEVAL_ABLATION_IDS } from '@/core/recall/eval/retrieval-ablation-ids'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import {
  applyAblationExcludeHardFilter,
  formatRetrievalAblationSummary,
  runRetrievalAblation
} from '@/core/recall/eval/run-retrieval-ablation'
import { WORKER_EMBEDDING_MODEL_HINT } from '@/core/recall/eval/retrieval-ablation-fusion-constants'
import type { RecallMatch } from '@/core/recall/recall-result'

const ABLATION_OWNER = '11111111-1111-4111-8111-111111111111'
const ABLATION_PROFILE = '22222222-2222-4222-8222-222222222222'

describe('retrieval-ablation · 固定条件', () => {
  it('nowMs 与 recall-eval 对齐', () => {
    expect(RETRIEVAL_ABLATION_NOW_MS).toBe(RECALL_EVAL_NOW_MS)
  })

  it('corpus 无预填 embedding，id 稳定唯一', () => {
    const corpus = buildRetrievalAblationCorpus()
    assertAblationCorpusHasNoEmbeddings(corpus)
    const ids = corpus.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(Object.values(RETRIEVAL_ABLATION_IDS)))
  })

  it('用例均带 goldParsed / 场景 / 判定依据，且不依赖 embeddingAnchor', () => {
    expect(RETRIEVAL_ABLATION_CASES.length).toBeGreaterThanOrEqual(18)
    const scenarios = new Set(RETRIEVAL_ABLATION_CASES.map(item => item.scenario))
    expect(scenarios.has('zero_overlap')).toBe(true)
    expect(scenarios.has('fuzzy_memory')).toBe(true)
    expect(scenarios.has('negative_no_match')).toBe(true)
    expect(RETRIEVAL_ABLATION_CASES.some(item => item.labelConfidence === 'ambiguous')).toBe(true)
    for (const item of RETRIEVAL_ABLATION_CASES) {
      expect(item.goldParsed.contentTerms).toBeDefined()
      expect(item.goldParsed.raw).toBeTruthy()
      expect(item.judgmentZh.length).toBeGreaterThan(8)
      expect(item.scenario).toBeTruthy()
      expect('embeddingAnchor' in item).toBe(false)
      if (item.labelConfidence === 'ambiguous') {
        expect(item.labelAmbiguityZh?.length).toBeGreaterThan(8)
      }
    }
  })

  it('裁定：trinity/fermi 待复核；yellowstone 旧案 ambiguous；A/B 新案独立 clear', () => {
    const trinity = RETRIEVAL_ABLATION_CASES.find(
      item => item.id === 'ablate-fuzzy-trinity-test-film'
    )
    const fermi = RETRIEVAL_ABLATION_CASES.find(item => item.id === 'ablate-fuzzy-fermi-pile-notes')
    expect(trinity?.expectation).toEqual({
      kind: 'hit',
      expectedId: RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt
    })
    expect(trinity?.goldReviewStatus).toBe('pending_review')
    expect(fermi?.expectation).toEqual({
      kind: 'hit',
      expectedId: RETRIEVAL_ABLATION_IDS.pureSemanticPhysicistsNote
    })
    expect(fermi?.goldReviewStatus).toBe('pending_review')

    const oldYellowstone = RETRIEVAL_ABLATION_CASES.find(
      item => item.id === 'ablate-nomatch-yellowstone-not-hiking'
    )
    expect(oldYellowstone?.labelConfidence).toBe('ambiguous')
    expect(oldYellowstone?.expectation.kind).toBe('miss')

    const intentA = RETRIEVAL_ABLATION_CASES.find(
      item => item.id === 'ablate-yellowstone-exclude-hike-clear'
    )
    const intentB = RETRIEVAL_ABLATION_CASES.find(
      item => item.id === 'ablate-yellowstone-find-hike-clear'
    )
    expect(intentA?.labelConfidence).toBe('clear')
    expect(intentA?.expectation).toEqual({
      kind: 'miss',
      expectedId: RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt,
      k: 5
    })
    expect(intentA?.goldParsed.excludeContentTerms).toEqual(['day-hike', 'packing', 'checklist'])
    expect(intentA?.goldParsed.contentTerms).toEqual([
      'yellowstone',
      'lodging',
      'booking',
      'confirmation',
      'summer'
    ])
    expect(intentB?.labelConfidence).toBe('clear')
    expect(intentB?.expectation).toEqual({
      kind: 'hit',
      expectedId: RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt
    })
    expect(intentB?.goldParsed.excludeContentTerms ?? []).toEqual([])
    // 新旧 id 并存，新案不覆盖旧案
    expect(oldYellowstone && intentA && intentB).toBeTruthy()
    expect(oldYellowstone!.id).not.toBe(intentA!.id)
    expect(oldYellowstone!.id).not.toBe(intentB!.id)
  })
})

describe('retrieval-ablation · exclude 硬过滤幂等与分计', () => {
  it('filterMatchesByExcludeContentTerms 二次调用幂等', () => {
    const corpus = buildRetrievalAblationCorpus()
    const hiking = corpus.find(item => item.id === RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt)!
    const other = corpus.find(item => item.id !== hiking.id)!
    const matches: RecallMatch[] = [
      { item: hiking, score: 20, matchedFields: ['title'] },
      { item: other, score: 10, matchedFields: ['title'] }
    ]
    const terms = ['day-hike', 'packing', 'checklist']
    const once = filterMatchesByExcludeContentTerms(matches, terms)
    const twice = filterMatchesByExcludeContentTerms(once, terms)
    expect(once.map(match => match.item.id)).toEqual(twice.map(match => match.item.id))
    expect(once.some(match => match.item.id === hiking.id)).toBe(false)
  })

  it('诊断：编排内剔除与出口新增分计守恒；出口对已滤池新增为 0', () => {
    const lodging = createTextExcerptMemoryItem({
      ownerId: ABLATION_OWNER,
      sourceLocalProfileId: ABLATION_PROFILE,
      now: () => '2026-07-25T12:00:00.000Z',
      payload: {
        selectedText: 'Summer cabin reservation confirmation',
        sourceUrl: 'https://example.com/lodging',
        pageTitle: 'Yellowstone lodging booking confirmation'
      }
    })
    const hiking = createTextExcerptMemoryItem({
      ownerId: ABLATION_OWNER,
      sourceLocalProfileId: ABLATION_PROFILE,
      now: () => '2026-07-25T12:00:00.000Z',
      payload: {
        selectedText: 'Day hike packing checklist for Yellowstone',
        sourceUrl: 'https://example.com/hike',
        pageTitle: 'Yellowstone day hike checklist'
      }
    })
    const before: RecallMatch[] = [
      { item: lodging, score: 30, matchedFields: ['title'] },
      { item: hiking, score: 20, matchedFields: ['title'] }
    ]
    const terms = ['day-hike', 'packing', 'checklist']
    // 模拟编排内已滤掉 hiking
    const enteringExit = filterMatchesByExcludeContentTerms(before, terms)
    const { matchesAfter, diagnostics } = applyAblationExcludeHardFilter(
      enteringExit,
      terms,
      before
    )
    expect(diagnostics.orchestratorInternalExcludedCount).toBe(1)
    expect(diagnostics.exitNewExcludedCount).toBe(0)
    expect(diagnostics.excludedCount).toBe(1)
    expect(diagnostics.candidateCountBeforeExclude).toBe(2)
    expect(diagnostics.candidateCountAfterExclude).toBe(1)
    expect(matchesAfter.map(match => match.item.id)).toEqual([lodging.id])
    expect(diagnostics.excluded[0]?.hitExcludeTerms.length).toBeGreaterThan(0)
  })
})

describe('retrieval-ablation · keyword 可离线', () => {
  it('仅 keyword：固定 goldParsed；include 主口径 + clear-only 对照', async () => {
    const report = await runRetrievalAblation({ strategies: ['keyword'] })
    expect(report.meta.embedModel).toBeNull()
    expect(report.meta.strategies).toEqual(['keyword'])
    expect(report.meta.ambiguousInDenominator).toBe('include')
    expect(report.denominatorViews.include.mode).toBe('include')
    expect(report.denominatorViews.clearOnly.mode).toBe('clear_only')

    // 主口径 = include 视图
    expect(report.aggregateHitCases.keyword?.denominator).toBe(
      report.denominatorViews.include.hitCaseCount
    )
    expect(report.aggregateNegative.keyword?.caseCount).toBe(
      report.denominatorViews.include.negativeCaseCount
    )
    expect(report.meta.hitCaseCount).toBe(report.denominatorViews.include.hitCaseCount)
    expect(report.meta.negativeCaseCount).toBe(report.denominatorViews.include.negativeCaseCount)

    const includeHits = report.cases.filter(item => item.expectationKind === 'hit').length
    const clearHits = report.cases.filter(
      item => item.expectationKind === 'hit' && item.labelConfidence === 'clear'
    ).length
    const ambHits = includeHits - clearHits
    expect(report.denominatorViews.include.hitCaseCount).toBe(includeHits)
    expect(report.denominatorViews.clearOnly.hitCaseCount).toBe(clearHits)
    expect(report.denominatorViews.clearOnly.ambiguousCaseCount).toBe(0)
    expect(report.denominatorViews.include.ambiguousCaseCount).toBe(
      report.cases.filter(item => item.labelConfidence === 'ambiguous').length
    )
    expect(ambHits).toBeGreaterThan(0)
    // clear-only 分母严格小于 include（有 ambiguous hit）
    expect(report.denominatorViews.clearOnly.hitCaseCount).toBeLessThan(
      report.denominatorViews.include.hitCaseCount
    )

    const summary = formatRetrievalAblationSummary(report)
    expect(summary).toContain('main[include]')
    expect(summary).toContain('clear-only')
    expect(summary).toContain('禁止混用')
    expect(summary).toContain('inPoolNotTop1=')
  })

  it('排名区间互斥且汇总可复算（include 与 clear-only）', async () => {
    const report = await runRetrievalAblation({ strategies: ['keyword'] })
    for (const view of [report.denominatorViews.include, report.denominatorViews.clearOnly]) {
      const agg = view.aggregateHitCases.keyword
      expect(agg).not.toBeNull()
      expect(agg!.candidateMissCount + agg!.inPoolOutsideTop5Count + agg!.recallAt5HitCount).toBe(
        agg!.denominator
      )

      const hits = report.cases.filter(item => {
        if (item.expectationKind !== 'hit') {
          return false
        }
        if (view.mode === 'clear_only' && item.labelConfidence !== 'clear') {
          return false
        }
        return true
      })

      let top1 = 0
      let notTop1 = 0
      let outside5 = 0
      let miss = 0
      for (const item of hits) {
        const row = item.byStrategy.keyword!
        const flags = [
          row.observedStage === 'candidate_miss',
          row.observedStage === 'in_pool_outside_top5',
          Boolean(row.goldInCandidates && row.recallAt5)
        ]
        expect(flags.filter(Boolean)).toHaveLength(1)
        if (row.observedStage === 'candidate_miss') {
          miss += 1
        } else if (row.observedStage === 'in_pool_outside_top5') {
          outside5 += 1
        } else if (row.recallAt1) {
          top1 += 1
        } else {
          notTop1 += 1
        }
      }
      expect(miss).toBe(agg!.candidateMissCount)
      expect(outside5).toBe(agg!.inPoolOutsideTop5Count)
      expect(notTop1).toBe(agg!.inPoolNotTop1Count)
      expect(top1 + notTop1).toBe(agg!.recallAt5HitCount)
      expect(miss + outside5 + top1 + notTop1).toBe(agg!.denominator)
    }
  })

  it('意图 A：keyword 滤后无 hiking；出口新增剔除为 0；意图 B 仍 hit', async () => {
    const report = await runRetrievalAblation({ strategies: ['keyword'] })
    expect(report.meta.hybridVsProduction.excludeHardFilter).toBe(
      'aligned_filterMatchesByExcludeContentTerms'
    )

    const intentA = report.cases.find(
      item => item.caseId === 'ablate-yellowstone-exclude-hike-clear'
    )
    expect(intentA).toBeTruthy()
    const rowA = intentA!.byStrategy.keyword!
    expect(rowA.negativeFalsePositive).toBe(false)
    expect(rowA.rankedIds).not.toContain(RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt)
    expect(rowA.excludeDiagnostics.excludeContentTerms).toEqual([
      'day-hike',
      'packing',
      'checklist'
    ])
    expect(rowA.excludeDiagnostics.exitNewExcludedCount).toBe(0)
    expect(rowA.excludeDiagnostics.excludedCount).toBe(
      rowA.excludeDiagnostics.orchestratorInternalExcludedCount +
        rowA.excludeDiagnostics.exitNewExcludedCount
    )
    if (rowA.negativeFalsePositiveBeforeExclude) {
      expect(rowA.excludePreventedFp).toBe(true)
      expect(rowA.excludeDiagnostics.excludedCount).toBeGreaterThan(0)
    }

    const intentB = report.cases.find(item => item.caseId === 'ablate-yellowstone-find-hike-clear')
    expect(intentB).toBeTruthy()
    const rowB = intentB!.byStrategy.keyword!
    expect(rowB.goldInCandidates).toBe(true)
    expect(rowB.excludeDiagnostics.excludeContentTerms).toEqual([])
    expect(rowB.excludeDiagnostics.excludedCount).toBe(0)
    expect(rowB.rankedIds).toContain(RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt)
  })

  it('无 embedClient 时请求 semantic 必须抛错（禁止 fake 静默）', async () => {
    await expect(runRetrievalAblation({ strategies: ['semantic'] })).rejects.toThrow(
      /真实 embedClient/
    )
  })

  it('错误 model 字符串拒绝', async () => {
    await expect(
      runRetrievalAblation({
        strategies: ['semantic'],
        embedClient: {
          model: 'fake-hash-model',
          embedTexts: async () => {
            throw new Error('should not run')
          }
        }
      })
    ).rejects.toThrow(WORKER_EMBEDDING_MODEL_HINT)
  })

  it('embed 返回空向量必须抛错（禁止当成功续算）', async () => {
    await expect(
      runRetrievalAblation({
        strategies: ['semantic'],
        embedClient: {
          model: WORKER_EMBEDDING_MODEL_HINT,
          embedTexts: async texts => texts.map(() => [])
        }
      })
    ).rejects.toThrow(/空向量|embed 失败/)
  })
})
