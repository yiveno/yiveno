import { describe, expect, it } from 'vitest'

import { PARSE_GOLD_CASES } from '@/core/recall/eval/parse-gold-cases'
import { runParseGold } from '@/core/recall/eval/run-parse-gold'

describe('parse-gold', () => {
  it('用例 id 唯一且 must/stretch 均有覆盖', () => {
    const ids = PARSE_GOLD_CASES.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(PARSE_GOLD_CASES.some(item => item.gate === 'must')).toBe(true)
    expect(PARSE_GOLD_CASES.some(item => item.gate === 'stretch')).toBe(true)
    expect(PARSE_GOLD_CASES.length).toBeGreaterThanOrEqual(20)
  })

  it('must：规则 parser 槽位全部对齐金标', () => {
    const report = runParseGold()

    if (report.must.failed.length > 0) {
      const summary = report.must.failed
        .map(
          item =>
            `- ${item.caseId} clue="${item.clue}": ${item.detail} | parsed=${JSON.stringify({
              time: item.parsed.timeRange?.label,
              types: item.parsed.objectTypes,
              behavior: item.parsed.behaviorHints,
              note: item.parsed.noteHint,
              terms: item.parsed.contentTerms,
              confidence: item.parsed.confidence
            })}`
        )
        .join('\n')
      expect.fail(`must 失败 ${report.must.failed.length}/${report.must.total}:\n${summary}`)
    }

    expect(report.must.passed).toBe(report.must.total)
  })

  it('stretch：汇报规则相对理想金标的缺口（不挡门禁）', () => {
    const report = runParseGold()
    expect(report.stretch.total).toBeGreaterThan(0)

    const failedSummary = report.stretch.failed
      .map(item => `${item.caseId}: ${item.detail}`)
      .join('; ')
    console.info(
      `[parse-gold] rules stretch ${report.stretch.passed}/${report.stretch.total}` +
        (failedSummary ? ` | fail: ${failedSummary}` : '')
    )
  })
})
