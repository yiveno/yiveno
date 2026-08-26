import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import {
  enrichEmptyRecallResult,
  findRelatedGuessMatch,
  hasStrongRecallConstraints
} from '@/core/recall/enrich-empty-recall-result'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { MemoryItem } from '@/core/memory/memory-item'

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222'
}

function videoBookmark(createdAt: string, title: string): MemoryItem {
  const item = createBookmarkMemoryItem({
    ...baseContext,
    now: () => createdAt,
    payload: { title, url: 'https://example.com/v', domain: 'example.com' }
  })
  return {
    ...item,
    createdAt,
    updatedAt: createdAt,
    clues: {
      ...item.clues,
      tags: [...item.clues.tags, 'video'],
      title
    }
  }
}

describe('enrichEmptyRecallResult', () => {
  it('强约束 = 时间 + 类型', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    expect(hasStrongRecallConstraints(parsed)).toBe(true)
  })

  it('窗内无同类 → constrained_none + 最近同类猜测', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const older = videoBookmark('2026-07-01T10:00:00.000Z', 'Old film notes')
    const result = enrichEmptyRecallResult(
      {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: parsed.raw
      },
      [older],
      parsed
    )
    expect(result.emptyKind).toBe('constrained_none')
    expect(result.relatedGuess?.item.id).toBe(older.id)
  })

  it('窗内已有同类 → 不报库空（避免误伤 Filter 漏检）', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const inWindow = videoBookmark('2026-08-07T15:00:00.000Z', 'Yesterday clip')
    const result = enrichEmptyRecallResult(
      {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: parsed.raw
      },
      [inWindow],
      parsed
    )
    expect(result.emptyKind).toBe('unconstrained')
    expect(result.relatedGuess).toBeNull()
  })

  it('无同类条目时 relatedGuess 为 null', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    expect(findRelatedGuessMatch([], parsed)).toBeNull()
  })
})
