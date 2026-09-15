import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import {
  applyOutcomePairScoreAdjustments,
  buildRecallOutcomePairRecord,
  fingerprintRecallClue,
  RECALL_OUTCOME_PAIR_NEGATIVE_PENALTY,
  RECALL_OUTCOME_PAIR_POSITIVE_BOOST
} from '@/core/recall/recall-outcome-pairs'
import type { RecallMatch } from '@/core/recall/recall-result'

const ownerId = '11111111-1111-4111-8111-111111111111'
const sourceLocalProfileId = '22222222-2222-4222-8222-222222222222'

function matchFor(id: string, score: number, title: string): RecallMatch {
  const item = createBookmarkMemoryItem({
    ownerId,
    sourceLocalProfileId,
    payload: { title, url: `https://example.com/${id}` },
    now: () => '2026-08-24T00:00:00.000Z'
  })
  return {
    item: { ...item, id },
    score,
    matchedFields: ['title']
  }
}

describe('fingerprintRecallClue', () => {
  it('折叠空白与大小写', () => {
    expect(fingerprintRecallClue('  Peck  Fable ')).toBe(fingerprintRecallClue('peck fable'))
  })
})

describe('buildRecallOutcomePairRecord', () => {
  it('target 须 countsAsSettled', () => {
    expect(
      buildRecallOutcomePairRecord({
        effectiveClue: 'peck fable',
        label: 'target',
        targetId: 'a',
        resultIds: ['a'],
        source: 'exit_prompt',
        confidence: 'strong',
        countsAsSettled: false
      })
    ).toBeNull()

    expect(
      buildRecallOutcomePairRecord({
        effectiveClue: 'peck fable',
        label: 'target',
        targetId: 'a',
        resultIds: ['a'],
        source: 'exit_prompt',
        confidence: 'strong',
        countsAsSettled: true
      })
    ).toMatchObject({ label: 'target', targetId: 'a' })
  })

  it('none_in_results 带 negativeIds', () => {
    const pair = buildRecallOutcomePairRecord({
      effectiveClue: 'wrong batch',
      label: 'none_in_results',
      resultIds: ['x', 'y'],
      source: 'dismiss',
      confidence: 'strong',
      countsAsSettled: false
    })
    expect(pair?.negativeIds).toEqual(['x', 'y'])
  })
})

describe('applyOutcomePairScoreAdjustments', () => {
  it('正例升权、硬负例降权并重排', () => {
    const matches = [
      matchFor('neg', 20, 'Noise'),
      matchFor('pos', 18, 'Target'),
      matchFor('other', 19, 'Other')
    ]
    const fp = fingerprintRecallClue('peck fable')
    const adjusted = applyOutcomePairScoreAdjustments(matches, fp, [
      {
        fingerprint: fp,
        cluePreview: 'peck fable',
        label: 'target',
        targetId: 'pos',
        source: 'exit_prompt',
        confidence: 'strong',
        createdAt: '2026-08-24T00:00:00.000Z'
      },
      {
        fingerprint: fp,
        cluePreview: 'peck fable',
        label: 'none_in_results',
        negativeIds: ['neg'],
        source: 'dismiss',
        confidence: 'strong',
        createdAt: '2026-08-24T00:00:00.000Z'
      }
    ])

    expect(adjusted[0]?.item.id).toBe('pos')
    expect(adjusted.find(m => m.item.id === 'pos')?.score).toBe(
      18 + RECALL_OUTCOME_PAIR_POSITIVE_BOOST
    )
    expect(adjusted.find(m => m.item.id === 'neg')?.score).toBe(
      Math.max(0, 20 - RECALL_OUTCOME_PAIR_NEGATIVE_PENALTY)
    )
    expect(adjusted.find(m => m.item.id === 'pos')?.matchedFields).toContain('outcomePair')
  })

  it('contentTerms 非空时：无佐证正例不得升权', () => {
    const matches = [
      matchFor('noise', 20, 'Standup scrap blockers'),
      matchFor('keep', 18, 'Cloud recording retention')
    ]
    const fp = fingerprintRecallClue('yesterday about retention')
    const adjusted = applyOutcomePairScoreAdjustments(
      matches,
      fp,
      [
        {
          fingerprint: fp,
          cluePreview: 'yesterday about retention',
          label: 'target',
          targetId: 'noise',
          source: 'settled_single',
          confidence: 'medium',
          createdAt: '2026-09-11T00:00:00.000Z'
        }
      ],
      { contentTerms: ['retention'] }
    )
    expect(adjusted.find(m => m.item.id === 'noise')?.score).toBe(20)
    expect(adjusted.find(m => m.item.id === 'noise')?.matchedFields).not.toContain('outcomePair')
  })
})
