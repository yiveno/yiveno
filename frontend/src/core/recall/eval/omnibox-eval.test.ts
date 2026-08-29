import { describe, expect, it } from 'vitest'

import { buildRecallEvalCorpus } from '@/core/recall/eval/recall-eval-corpus'
import { RECALL_EVAL_IDS } from '@/core/recall/eval/recall-eval-ids'
import {
  OMNIBOX_EVAL_CASES,
  OMNIBOX_EVAL_EXPECTED_IDS
} from '@/core/recall/eval/omnibox-eval-cases'
import {
  assertOmniboxUnderstandSourceRules,
  runOmniboxEval
} from '@/core/recall/eval/run-omnibox-eval'

describe('omnibox-eval', () => {
  it('corpus 含 omnibox must 期望 id', () => {
    const corpusIds = new Set(buildRecallEvalCorpus().map(item => item.id))
    for (const id of OMNIBOX_EVAL_EXPECTED_IDS) {
      expect(corpusIds.has(id)).toBe(true)
    }
    expect(OMNIBOX_EVAL_EXPECTED_IDS).toContain(RECALL_EVAL_IDS.chromeExtensionMv3)
  })

  it('omnibox_must 全部通过（规则 parse + 关键词 Filter）', async () => {
    const report = await runOmniboxEval(OMNIBOX_EVAL_CASES)

    if (report.must.failed.length > 0) {
      const summary = report.must.failed
        .map(item => `- ${item.caseId} clue="${item.clue}": ${item.detail}`)
        .join('\n')
      throw new Error(
        `omnibox_must 失败 ${report.must.failed.length}/${report.must.total}:\n${summary}`
      )
    }

    expect(report.must.passed).toBe(report.must.total)
    expect(report.must.total).toBe(OMNIBOX_EVAL_CASES.length)
  })

  it('Omnibox 轨理解来源为 rules（非 LLM）', async () => {
    const report = await runOmniboxEval(OMNIBOX_EVAL_CASES)
    const violations = assertOmniboxUnderstandSourceRules(OMNIBOX_EVAL_CASES, report)
    expect(violations).toEqual([])
  })
})
