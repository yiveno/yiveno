import { describe, expect, it } from 'vitest'

import {
  advanceRecallVisibleProgress,
  shouldRevealRecallVisibleProgress
} from '@/core/recall/visible-progress'
import { selectRecallVisibleProgressBasisKinds } from '@/core/recall/visible-progress-basis'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

describe('visible-progress', () => {
  it('500ms 前不揭示阶段', () => {
    expect(shouldRevealRecallVisibleProgress(0)).toBe(false)
    expect(shouldRevealRecallVisibleProgress(499)).toBe(false)
    expect(shouldRevealRecallVisibleProgress(500)).toBe(true)
  })

  it('导出阶段最短停留常量（防后两步闪没）', async () => {
    const { RECALL_VISIBLE_PROGRESS_STAGE_MIN_DWELL_MS } =
      await import('@/core/recall/visible-progress')
    expect(RECALL_VISIBLE_PROGRESS_STAGE_MIN_DWELL_MS).toBeGreaterThanOrEqual(300)
  })

  it('阶段推进写入 completed 且不重复 current', () => {
    const mid = advanceRecallVisibleProgress(null, 'understanding', [])
    expect(mid).toEqual({ current: 'understanding', completed: [] })
    const next = advanceRecallVisibleProgress(mid.current, 'narrowing', mid.completed)
    expect(next).toEqual({ current: 'narrowing', completed: ['understanding'] })
    const last = advanceRecallVisibleProgress(next.current, 'checking', next.completed)
    expect(last).toEqual({
      current: 'checking',
      completed: ['understanding', 'narrowing']
    })
  })
})

describe('visible-progress-basis', () => {
  const baseParsed = (over: Partial<ParsedRecallClue> = {}): ParsedRecallClue => ({
    raw: 'that article',
    contentTerms: [],
    confidence: 'medium',
    ...over
  })

  it('无槽位则空', () => {
    expect(selectRecallVisibleProgressBasisKinds({ parsed: baseParsed() })).toEqual([])
  })

  it('按真实槽位选 timing / purpose，域名桶才有 source', () => {
    expect(
      selectRecallVisibleProgressBasisKinds({
        parsed: baseParsed({
          timeRange: {
            label: 'recent',
            from: '2026-01-01T00:00:00.000Z',
            to: '2026-01-08T00:00:00.000Z'
          },
          contentTerms: ['retention']
        })
      })
    ).toEqual(['timing', 'purpose'])

    expect(
      selectRecallVisibleProgressBasisKinds({
        parsed: baseParsed({ contentTerms: ['js'] }),
        framingFacts: {
          kind: 'candidates',
          stance: 'confident_neighborhood',
          understood: {
            contentTerms: ['js'],
            objectTypes: [],
            behaviorHints: [],
            noteHint: false
          },
          retrievalPath: 'literal',
          buckets: [
            {
              id: 'domain:example.com',
              labelKey: 'framing_bucket_domain',
              count: 3,
              domain: 'example.com'
            }
          ],
          counts: { total: 3, shown: 3 },
          isWideNeighborhood: false
        }
      })
    ).toEqual(['source', 'purpose'])
  })
})
