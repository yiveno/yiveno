import { describe, expect, it } from 'vitest'

import {
  RECALL_FRAMING_EVAL_CASES,
  runRecallFramingEval
} from '@/core/recall/eval/recall-framing-eval'

describe('recall-framing-eval', () => {
  it('用例 id 唯一', () => {
    const ids = RECALL_FRAMING_EVAL_CASES.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('framing-* must 全部通过', () => {
    const report = runRecallFramingEval()
    if (report.must.failed.length > 0) {
      const summary = report.must.failed.map(item => `${item.id}: ${item.detail}`).join('\n')
      expect.fail(
        `framing must 失败 ${report.must.failed.length}/${report.must.total}:\n${summary}`
      )
    }
    expect(report.must.passed).toBe(report.must.total)
    expect(report.must.total).toBeGreaterThanOrEqual(2)
  })
})
