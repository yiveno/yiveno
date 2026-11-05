import { describe, expect, it } from 'vitest'

import { buildSynthNoiseGatewayCases } from '@/core/recall/eval/build-synth-noise-gateway-cases'
import { NOISE_GATEWAY_HAND_CASES } from '@/core/recall/eval/noise-gateway-cases'
import {
  buildNoiseGatewayEvalCases,
  runNoiseGatewayEval
} from '@/core/recall/eval/run-noise-gateway-eval'

describe('noise-gateway-eval', () => {
  it('用例 id 唯一且 must/stretch 均有覆盖', () => {
    const cases = buildNoiseGatewayEvalCases()
    const ids = cases.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(cases.some(item => item.gate === 'must')).toBe(true)
    expect(cases.some(item => item.gate === 'stretch')).toBe(true)
    expect(NOISE_GATEWAY_HAND_CASES.length).toBeGreaterThanOrEqual(20)
    expect(buildSynthNoiseGatewayCases().length).toBeGreaterThanOrEqual(40)
  })

  it('must：人手金标零误伤 + 合成硬噪音必拦', () => {
    const report = runNoiseGatewayEval()

    if (report.must.failed.length > 0) {
      const summary = report.must.failed
        .map(item => `- ${item.caseId} clue=${JSON.stringify(item.clue)}: ${item.detail}`)
        .join('\n')
      expect.fail(`must 失败 ${report.must.failed.length}/${report.must.total}:\n${summary}`)
    }

    expect(report.must.passed).toBe(report.must.total)
    // 人手 must + 合成硬噪音；不再并入 PARSE_GOLD_CASES
    expect(report.must.total).toBeGreaterThanOrEqual(40)
  })

  it('stretch：汇报灰区（不挡门禁）', () => {
    const report = runNoiseGatewayEval()
    expect(report.stretch.total).toBeGreaterThan(0)

    const failedSummary = report.stretch.failed
      .map(item => `${item.caseId}: ${item.detail}`)
      .join('; ')
    console.info(
      `[noise-gateway-eval] must ${report.must.passed}/${report.must.total}` +
        ` | stretch ${report.stretch.passed}/${report.stretch.total}` +
        (failedSummary ? ` | stretch-fail: ${failedSummary}` : '')
    )
  })
})
