import { describe, expect, it } from 'vitest'

import { formatEvalFailureObservationLine } from '@/core/recall/eval/eval-failure-observation'
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
        .map(
          item =>
            `- ${item.caseId} clue="${item.clue}": ${item.detail}\n  ${formatEvalFailureObservationLine(item.caseId, item.failureObservation)}`
        )
        .join('\n')
      throw new Error(
        `must 用例失败 ${report.must.failed.length}/${report.must.total}:\n${summary}`
      )
    }

    expect(report.must.passed).toBe(report.must.total)
  })

  it('R0：空库任意口语须诚实 no_match 且无 topPick', () => {
    const report = runRecallEval(
      [
        {
          id: 'r0-empty-library-favorite-song',
          clue: 'the song I used to like most',
          clueClass: 'negative',
          gate: 'must',
          expectation: { kind: 'no_match' },
          note: '空库找不到是正确行为；随机甩一条才是致命'
        }
      ],
      []
    )
    expect(report.must.failed).toEqual([])
    expect(report.cases[0]?.result.topPick).toBeNull()
    expect(report.cases[0]?.result.alsoPossible).toEqual([])
  })

  it('R0 must 档位覆盖：A 命中 / B 追问 / 诚实空', () => {
    const byId = new Map(RECALL_EVAL_CASES.map(item => [item.id, item]))
    expect(byId.get('concrete-domain-github')?.expectation.kind).toBe('top1')
    expect(byId.get('need-a-clue-weak-title-fragment')?.expectation.kind).toBe('top1')
    expect(byId.get('r0-zero-anchor-assistant-command')?.expectation.kind).toBe('no_match')
    expect(byId.get('dialog-refine-time-after-type-b-note')?.dialogTurns?.length).toBe(2)
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
    for (const item of report.stretch.failed) {
      console.info(
        `[recall-eval] stretch-obs ${formatEvalFailureObservationLine(item.caseId, item.failureObservation)}`
      )
    }
  })

  it('失败观察：通过用例为 not_applicable；根因策略恒 not_inferred', () => {
    const report = runRecallEval(RECALL_EVAL_CASES)
    for (const item of report.cases) {
      expect(item.failureObservation.rootCausePolicy).toBe('not_inferred')
      expect(item.failureObservation.inferredRootCause).toBeNull()
      if (item.passed) {
        expect(item.failureObservation.observedStage).toBe('not_applicable')
      }
    }
  })
})
