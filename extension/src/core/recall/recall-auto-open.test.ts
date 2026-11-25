import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { RECALL_TOP_PICK_MIN_SCORE } from '@/core/recall/keyword-filter-weights'
import {
  RECALL_AUTO_OPEN_MIN_GAP,
  shouldAutoOpenRecallResult
} from '@/core/recall/recall-auto-open'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'

function match(id: string, score: number): RecallMatch {
  return {
    item: createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: { title: id, url: `https://example.com/${id}` },
      clues: {}
    }),
    score,
    matchedFields: ['title']
  }
}

function result(partial: Partial<RecallResult> & Pick<RecallResult, 'outcome'>): RecallResult {
  return {
    topPick: null,
    alsoPossible: [],
    totalRankedCount: 0,
    clue: 'test',
    ...partial
  }
}

describe('shouldAutoOpenRecallResult', () => {
  it('过门：top_pick 且无 alsoPossible', () => {
    expect(
      shouldAutoOpenRecallResult(
        result({
          outcome: 'top_pick',
          topPick: match('a', RECALL_TOP_PICK_MIN_SCORE),
          alsoPossible: [],
          totalRankedCount: 1
        })
      )
    ).toBe(true)
  })

  it('过门：分差 ≥ RECALL_AUTO_OPEN_MIN_GAP', () => {
    const top = RECALL_TOP_PICK_MIN_SCORE + RECALL_AUTO_OPEN_MIN_GAP
    expect(
      shouldAutoOpenRecallResult(
        result({
          outcome: 'top_pick',
          topPick: match('a', top),
          alsoPossible: [match('b', top - RECALL_AUTO_OPEN_MIN_GAP)],
          totalRankedCount: 2
        })
      )
    ).toBe(true)
  })

  it('分差边界 10 过门、9 不开', () => {
    const top = 40
    expect(
      shouldAutoOpenRecallResult(
        result({
          outcome: 'top_pick',
          topPick: match('a', top),
          alsoPossible: [match('b', top - 10)],
          totalRankedCount: 2
        })
      )
    ).toBe(true)
    expect(
      shouldAutoOpenRecallResult(
        result({
          outcome: 'top_pick',
          topPick: match('a', top),
          alsoPossible: [match('b', top - 9)],
          totalRankedCount: 2
        })
      )
    ).toBe(false)
  })

  it('need_a_clue / no_match 不开', () => {
    expect(
      shouldAutoOpenRecallResult(
        result({
          outcome: 'need_a_clue',
          topPick: null,
          alsoPossible: [match('a', 12)],
          totalRankedCount: 1
        })
      )
    ).toBe(false)
    expect(
      shouldAutoOpenRecallResult(
        result({
          outcome: 'no_match',
          topPick: null,
          alsoPossible: [],
          totalRankedCount: 0
        })
      )
    ).toBe(false)
  })

  it('头名分不足 Top Pick 门槛不开', () => {
    expect(
      shouldAutoOpenRecallResult(
        result({
          outcome: 'top_pick',
          topPick: match('a', RECALL_TOP_PICK_MIN_SCORE - 1),
          alsoPossible: [],
          totalRankedCount: 1
        })
      )
    ).toBe(false)
  })
})
