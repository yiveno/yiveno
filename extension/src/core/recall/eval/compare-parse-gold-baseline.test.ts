import { describe, expect, it } from 'vitest'

import {
  compareMustRegressionsToBaseline,
  extractParseGoldBaselineSnapshot,
  formatParseGoldBaselineCompareSummary
} from '@/core/recall/eval/compare-parse-gold-baseline'

describe('extractParseGoldBaselineSnapshot', () => {
  it('抽出 schemaVersion≥2 的 must 回归清单', () => {
    const snap = extractParseGoldBaselineSnapshot({
      schemaVersion: 2,
      model: 'deepseek-v4-flash',
      layers: {
        L2_parse_gold: {
          llm: { must: '31/35', stretch: '6/7' },
          mustRegressedByLlm: ['a', 'b']
        }
      }
    })
    expect(snap.model).toBe('deepseek-v4-flash')
    expect(snap.mustRegressedByLlm).toEqual(['a', 'b'])
    expect(snap.llmMustScore).toBe('31/35')
  })

  it('schemaVersion 1 拒绝', () => {
    expect(() =>
      extractParseGoldBaselineSnapshot({
        schemaVersion: 1,
        model: 'x',
        layers: { L2_parse_gold: { mustRegressedByLlm: [] } }
      })
    ).toThrow(/schemaVersion/)
  })
})

describe('compareMustRegressionsToBaseline', () => {
  const baseline = {
    schemaVersion: 2,
    model: 'deepseek-v4-flash',
    mustRegressedByLlm: [
      'p0-long-time-ago-bookmark',
      'must-wwii-related-video',
      'must-exclude-yellowstone-lodging-not-hike',
      'must-exclude-conflict-shared-topic-stays-positive'
    ],
    llmMustScore: '31/35'
  }

  it('与基线相同残差 → 通过', () => {
    const result = compareMustRegressionsToBaseline({
      currentMustRegressedByLlm: [...baseline.mustRegressedByLlm],
      baseline
    })
    expect(result.passed).toBe(true)
    expect(result.newRegressions).toEqual([])
    expect(result.knownResidual).toHaveLength(4)
    expect(result.healed).toEqual([])
  })

  it('新增回归 → 不通过', () => {
    const result = compareMustRegressionsToBaseline({
      currentMustRegressedByLlm: [...baseline.mustRegressedByLlm, 'must-brand-new-fail'],
      baseline
    })
    expect(result.passed).toBe(false)
    expect(result.newRegressions).toEqual(['must-brand-new-fail'])
  })

  it('治愈已知残差 → 仍通过并记 healed', () => {
    const result = compareMustRegressionsToBaseline({
      currentMustRegressedByLlm: ['must-wwii-related-video'],
      baseline
    })
    expect(result.passed).toBe(true)
    expect(result.healed).toContain('p0-long-time-ago-bookmark')
    expect(result.knownResidual).toEqual(['must-wwii-related-video'])
  })

  it('摘要含 PASS/FAIL', () => {
    const pass = compareMustRegressionsToBaseline({
      currentMustRegressedByLlm: [...baseline.mustRegressedByLlm],
      baseline
    })
    expect(formatParseGoldBaselineCompareSummary(pass)).toContain('PASS')
    const fail = compareMustRegressionsToBaseline({
      currentMustRegressedByLlm: ['extra-fail'],
      baseline
    })
    expect(formatParseGoldBaselineCompareSummary(fail)).toContain('FAIL')
  })
})
