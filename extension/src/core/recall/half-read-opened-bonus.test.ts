import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { computeBehaviorBoost } from '@/core/recall/keyword-filter'
import {
  RECALL_BEHAVIOR_BOOST_CAP,
  RECALL_HALF_READ_OPENED_BONUS
} from '@/core/recall/keyword-filter-weights'
import { applyParsedClueScoreBoosts } from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch } from '@/core/recall/recall-result'

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'

function openedBookmark(openCount: number) {
  return createBookmarkMemoryItem({
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    payload: { title: 'Article', url: 'https://example.com/a' },
    clues: { openCount }
  })
}

function matchOf(item: ReturnType<typeof createBookmarkMemoryItem>, score = 20): RecallMatch {
  return { item, score, matchedFields: ['title'] }
}

function parsedWithHalfRead(): ParsedRecallClue {
  return {
    raw: "didn't finish reading",
    intent: 'recall',
    confidence: 'medium',
    behaviorHints: ['half_read']
  } as ParsedRecallClue
}

describe('half_read opened bonus', () => {
  it('有打开记录加分', () => {
    const opened = openedBookmark(2)
    const before = 20
    const after = applyParsedClueScoreBoosts(
      matchOf(opened, before),
      parsedWithHalfRead(),
      Date.now()
    )
    const behavior = computeBehaviorBoost(opened)
    const expectedAdd = Math.min(
      RECALL_HALF_READ_OPENED_BONUS,
      RECALL_BEHAVIOR_BOOST_CAP - behavior
    )
    expect(after.score).toBe(before + expectedAdd)
    expect(expectedAdd).toBeGreaterThan(0)
  })

  it('无打开记录不加', () => {
    const never = openedBookmark(0)
    const before = 20
    const after = applyParsedClueScoreBoosts(
      matchOf(never, before),
      parsedWithHalfRead(),
      Date.now()
    )
    expect(after.score).toBe(before)
  })

  it('无 half_read 不加', () => {
    const opened = openedBookmark(3)
    const parsed = {
      raw: 'something',
      intent: 'recall',
      confidence: 'medium'
    } as ParsedRecallClue
    const before = 20
    const after = applyParsedClueScoreBoosts(matchOf(opened, before), parsed, Date.now())
    expect(after.score).toBe(before)
  })

  it('上限内：已满 CAP 时 half_read 不再加', () => {
    const hot = openedBookmark(64)
    hot.clues.settledCount = 64
    hot.clues.lastOpenedAt = new Date().toISOString()
    const behavior = computeBehaviorBoost(hot)
    expect(behavior).toBe(RECALL_BEHAVIOR_BOOST_CAP)
    const before = 20
    const after = applyParsedClueScoreBoosts(matchOf(hot, before), parsedWithHalfRead(), Date.now())
    expect(after.score).toBe(before)
  })
})
