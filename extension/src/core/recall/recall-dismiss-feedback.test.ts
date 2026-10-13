import { describe, expect, it } from 'vitest'

import { recallByKeyword } from '@/core/recall/build-recall-result'
import { buildRecallEvalCorpus } from '@/core/recall/eval/recall-eval-corpus'
import { RECALL_EVAL_IDS } from '@/core/recall/eval/recall-eval-ids'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

/** 为指定项叠加 dismissCount（模拟用户点过「这些都不对」）。 */
function withDismissCount(corpus: MemoryItem[], id: string, dismissCount: number): MemoryItem[] {
  return corpus.map(item =>
    item.id === id
      ? {
          ...item,
          clues: {
            ...item.clues,
            dismissCount,
            lastDismissedAt: '2026-07-25T12:00:00.000Z'
          }
        }
      : item
  )
}

function findMatch(result: RecallResult, id: string): RecallMatch | undefined {
  if (result.topPick?.item.id === id) {
    return result.topPick
  }
  return result.alsoPossible.find(match => match.item.id === id)
}

describe('recall-dismiss-feedback', () => {
  it('否定反馈降低 eval 语料中候选项得分', () => {
    const corpus = buildRecallEvalCorpus()
    const dismissedId = RECALL_EVAL_IDS.yivenoDesignPrinciples

    const baseline = recallByKeyword(corpus, 'Yiveno', { nowMs: RECALL_EVAL_NOW_MS })
    const beforeMatch = findMatch(baseline, dismissedId)
    expect(beforeMatch?.score).toBeGreaterThan(0)

    const afterDismiss = recallByKeyword(withDismissCount(corpus, dismissedId, 3), 'Yiveno', {
      nowMs: RECALL_EVAL_NOW_MS
    })
    const afterMatch = findMatch(afterDismiss, dismissedId)
    expect(afterMatch?.score).toBeLessThan(beforeMatch!.score)
  })
})
