import { describe, expect, it } from 'vitest'

import {
  buildParseGoldLlmJsonReport,
  PARSE_GOLD_LLM_REPORT_SCHEMA_VERSION,
  serializeParseGoldLlmJsonReport
} from '@/core/recall/eval/parse-gold-llm-report'
import type { ParseGoldCompareReport } from '@/core/recall/eval/compare-parse-gold'
import { SLOT_AGREEMENT_PROTOCOL } from '@/core/recall/eval/metrics'
import type { ParseGoldCaseResult } from '@/core/recall/eval/run-parse-gold'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')

function fakeCase(
  partial: Partial<ParseGoldCaseResult> &
    Pick<ParseGoldCaseResult, 'caseId' | 'gate' | 'passed' | 'detail'>
): ParseGoldCaseResult {
  return {
    clue: partial.clue ?? 'clue',
    parsed: partial.parsed ?? { raw: 'clue', contentTerms: [], confidence: 'low' },
    ...partial
  }
}

describe('buildParseGoldLlmJsonReport', () => {
  it('按调用序对齐 metrics；skip 不消耗下标；null → MISSING 序列化', () => {
    const llmCases = [
      fakeCase({
        caseId: 'ok-1',
        gate: 'must',
        passed: true,
        detail: 'ok'
      }),
      fakeCase({
        caseId: 'slot-1',
        gate: 'must',
        passed: false,
        detail: 'confidence 期望 high，实际 medium'
      }),
      fakeCase({
        caseId: 'skip-1',
        gate: 'stretch',
        passed: false,
        detail: '解析跳过: auth'
      }),
      fakeCase({
        caseId: 'schema-1',
        gate: 'stretch',
        passed: false,
        detail: '解析失败: bad json'
      })
    ]

    const compare: ParseGoldCompareReport = {
      rules: {
        must: { total: 1, passed: 1, failed: [] },
        stretch: { total: 1, passed: 0, failed: [] },
        cases: []
      },
      llm: {
        must: {
          total: 2,
          passed: 1,
          failed: [llmCases[1]!]
        },
        stretch: {
          total: 2,
          passed: 0,
          failed: [llmCases[2]!, llmCases[3]!]
        },
        cases: llmCases
      },
      stretchLiftedByLlm: [],
      mustRegressedByLlm: ['slot-1'],
      stretchStillFailing: ['skip-1', 'schema-1']
    }

    const report = buildParseGoldLlmJsonReport({
      compare,
      callMetrics: [
        {
          latencyMs: 100,
          usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 }
        },
        {
          latencyMs: 200,
          usage: { promptTokens: 11, completionTokens: 3, totalTokens: 14 }
        },
        {
          latencyMs: 50,
          usage: { promptTokens: null, completionTokens: null, totalTokens: null }
        }
      ],
      meta: {
        capturedAt: '2026-10-29T00:00:00.000Z',
        gitSha: 'abc',
        model: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
        compat: 'deepseek',
        temperature: 0,
        maxTokens: 400,
        disableThinking: true,
        nowMsIso: '2026-07-28T12:00:00.000Z',
        nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
        gateFilter: 'all',
        caseCount: 4,
        command: 'test',
        repoRoot
      }
    })

    expect(report.schemaVersion).toBe(PARSE_GOLD_LLM_REPORT_SCHEMA_VERSION)
    expect(report.schemaVersion).toBe(2)
    expect(report.slotAgreement.protocol).toBe(SLOT_AGREEMENT_PROTOCOL)
    expect(report.slotAgreement.metricKind).toBe('field_agreement')
    expect(report.layers.L1_schema).toEqual({
      passed: 2,
      failed: 1,
      skipped: 1,
      failedCaseIds: ['schema-1']
    })
    expect(report.cases[0]?.latencyMs).toBe(100)
    expect(report.cases[1]?.latencyMs).toBe(200)
    expect(report.cases[2]?.latencyMs).toBeNull()
    expect(report.cases[3]?.latencyMs).toBe(50)
    expect(report.cases[1]?.failureKind).toBe('slot')
    expect(report.cases[3]?.failureKind).toBe('schema')
    // 假 id 不在 PARSE_GOLD_CASES → 槽位全 NA
    expect(report.cases[0]?.slotAgreement.agreement).toBeNull()
    expect(report.slotAgreement.positive.mean).toBeNull()
    expect(report.slotAgreement.negative.mean).toBeNull()

    const text = serializeParseGoldLlmJsonReport(report)
    expect(text).toContain('"schemaVersion": 2')
    expect(text).toContain('"latencyMs": "MISSING"')
    expect(text).toContain('"promptTokens": "MISSING"')
    expect(text).toContain('"agreement": "NA"')
    expect(text).toContain('"mean": "NA"')
  })

  it('真实 exclude 金标 id：正负分列进报告；不改 mustRegressed 列表', () => {
    const llmCases = [
      fakeCase({
        caseId: 'must-exclude-yellowstone-lodging-not-hike',
        gate: 'must',
        passed: true,
        detail: '槽位对齐金标',
        clue: 'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist',
        parsed: {
          raw: 'clue',
          contentTerms: ['yellowstone', 'lodging', 'booking', 'confirmation', 'summer'],
          confidence: 'high',
          excludeContentTerms: ['day-hike', 'packing', 'checklist']
        }
      }),
      fakeCase({
        caseId: 'must-plain-query-no-exclude',
        gate: 'must',
        passed: false,
        detail: 'excludeContentTerms 期望空，实际 [oops]',
        clue: 'the privacy article from yesterday',
        parsed: {
          raw: 'clue',
          contentTerms: ['privacy'],
          confidence: 'high',
          timeRange: {
            from: '2026-07-27T00:00:00.000Z',
            to: '2026-07-27T23:59:59.999Z',
            label: 'yesterday'
          },
          excludeContentTerms: ['oops']
        }
      })
    ]

    const compare: ParseGoldCompareReport = {
      rules: {
        must: { total: 2, passed: 2, failed: [] },
        stretch: { total: 0, passed: 0, failed: [] },
        cases: []
      },
      llm: {
        must: {
          total: 2,
          passed: 1,
          failed: [llmCases[1]!]
        },
        stretch: { total: 0, passed: 0, failed: [] },
        cases: llmCases
      },
      stretchLiftedByLlm: [],
      mustRegressedByLlm: ['must-plain-query-no-exclude'],
      stretchStillFailing: []
    }

    const report = buildParseGoldLlmJsonReport({
      compare,
      callMetrics: [
        {
          latencyMs: 10,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
        },
        {
          latencyMs: 20,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
        }
      ],
      meta: {
        capturedAt: '2026-10-30T00:00:00.000Z',
        gitSha: 'def',
        model: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
        compat: 'deepseek',
        temperature: 0,
        maxTokens: 400,
        disableThinking: true,
        nowMsIso: '2026-07-28T12:00:00.000Z',
        nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
        gateFilter: 'must',
        caseCount: 2,
        command: 'test',
        repoRoot
      }
    })

    expect(report.layers.L2_parse_gold.mustRegressedByLlm).toEqual(['must-plain-query-no-exclude'])
    expect(report.cases[0]?.slotAgreement.negative.agreement).toBe(1)
    expect(report.cases[0]?.slotAgreement.positive.fields.contentTerms).toBe(true)
    expect(report.cases[1]?.slotAgreement.negative.agreement).toBe(0)
    expect(report.slotAgreement.negative.denominator).toBe(2)
    expect(report.slotAgreement.negative.perFieldHitRate.excludeContentTerms).toEqual({
      declaredCount: 2,
      passedCount: 1,
      hitRate: 0.5
    })
    expect(report.slotAgreement.positive.denominator).toBe(2)
  })
})
