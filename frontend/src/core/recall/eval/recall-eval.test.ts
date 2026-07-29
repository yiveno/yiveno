import { describe, expect, it } from 'vitest'

import { RECALL_EVAL_CASES } from '@/core/recall/eval/recall-eval-cases'
import { buildRecallEvalCorpus } from '@/core/recall/eval/recall-eval-corpus'
import { RECALL_EVAL_IDS } from '@/core/recall/eval/recall-eval-ids'
import { runRecallEval } from '@/core/recall/eval/run-recall-eval'

describe('recall-eval', () => {
  it('corpus 使用稳定 ID 且无重复', () => {
    const corpus = buildRecallEvalCorpus()
    const ids = corpus.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(Object.values(RECALL_EVAL_IDS)))
  })

  it('must 门禁用例全部通过（口语解析 + 关键词 Filter 主路径）', () => {
    const report = runRecallEval(RECALL_EVAL_CASES)

    if (report.must.failed.length > 0) {
      const summary = report.must.failed
        .map(item => `- ${item.caseId} clue="${item.clue}": ${item.detail}`)
        .join('\n')
      expect.fail(`must 用例失败 ${report.must.failed.length}/${report.must.total}:\n${summary}`)
    }

    expect(report.must.passed).toBe(report.must.total)
  })

  it('stretch 用例可汇报进度（不挡门禁）', () => {
    const report = runRecallEval(RECALL_EVAL_CASES)
    // 仅确保 runner 覆盖 stretch；通过率随优化上升，此处不强制 100%
    expect(report.stretch.total).toBeGreaterThan(0)
    expect(report.cases.filter(item => item.gate === 'stretch')).toHaveLength(report.stretch.total)

    const failedSummary = report.stretch.failed
      .map(item => `${item.caseId}: ${item.detail}`)
      .join('; ')
    // 便于本地看基线：当前关键词层对同义/错别字/真糊的覆盖
    console.info(
      `[recall-eval] stretch ${report.stretch.passed}/${report.stretch.total}` +
        (failedSummary ? ` | fail: ${failedSummary}` : '')
    )
  })
})
