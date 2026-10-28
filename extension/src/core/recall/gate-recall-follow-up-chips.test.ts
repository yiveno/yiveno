import { describe, expect, it } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch } from '@/core/recall/recall-result'
import {
  countRecallFollowUpChipEligibleCandidates,
  doesFollowUpChipValueCutCandidates,
  filterRecallFollowUpChipsByCutPower,
  isNonCuttingFollowUpMetaValue,
  shouldOfferRecallFollowUpChips
} from '@/core/recall/gate-recall-follow-up-chips'

const OWNER = '00000000-0000-4000-8000-000000000001'
const PROFILE = '00000000-0000-4000-8000-000000000002'

function bookmark(id: string, title: string, url = 'https://example.com/a'): MemoryItem {
  return {
    id,
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    type: 'bookmark',
    payload: {
      title,
      url,
      domain: 'example.com'
    },
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  }
}

function excerpt(id: string, text: string): MemoryItem {
  return {
    id,
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    type: 'text_excerpt',
    payload: {
      selectedText: text,
      pageTitle: 'Page',
      domain: 'papers.ssrn.com',
      sourceUrl: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1'
    },
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  }
}

function match(item: MemoryItem, score = 12): RecallMatch {
  return {
    item,
    score,
    matchedFields: ['title']
  }
}

describe('gate-recall-follow-up-chips', () => {
  it('邻域 ≤1 不挂芯片', () => {
    expect(shouldOfferRecallFollowUpChips(0)).toBe(false)
    expect(shouldOfferRecallFollowUpChips(1)).toBe(false)
    expect(shouldOfferRecallFollowUpChips(2)).toBe(true)
    expect(
      countRecallFollowUpChipEligibleCandidates({
        totalRankedCount: 1,
        topPick: null,
        alsoPossible: [match(bookmark('11111111-1111-4111-8111-111111111111', 'A'))]
      })
    ).toBe(1)
  })

  it('拒收记不清类元 value', () => {
    expect(isNonCuttingFollowUpMetaValue("I don't remember")).toBe(true)
    expect(isNonCuttingFollowUpMetaValue('not sure')).toBe(true)
    expect(isNonCuttingFollowUpMetaValue('working paper')).toBe(false)
  })

  it('类型芯片须切开混合邻域', () => {
    const pool = [
      match(bookmark('11111111-1111-4111-8111-111111111111', 'A')),
      match(excerpt('22222222-2222-4222-8222-222222222222', 'trust paper text'))
    ]
    expect(doesFollowUpChipValueCutCandidates('bookmark', pool)).toBe(true)
    expect(doesFollowUpChipValueCutCandidates('bookmark', [pool[0]!])).toBe(false)
  })

  it('字面芯片须部分覆盖候选', () => {
    const pool = [
      match(bookmark('11111111-1111-4111-8111-111111111111', 'Working Paper Trust')),
      match(bookmark('22222222-2222-4222-8222-222222222222', 'Cooking tips'))
    ]
    expect(doesFollowUpChipValueCutCandidates('working paper', pool)).toBe(true)
    expect(doesFollowUpChipValueCutCandidates('cooking', pool)).toBe(true)
    expect(doesFollowUpChipValueCutCandidates('tips', pool)).toBe(true)
    // 两标题都不含
    expect(doesFollowUpChipValueCutCandidates('quantum', pool)).toBe(false)
  })

  it('filter：N=1 清空；元芯片剔除；保留能切开的', () => {
    const chips = [
      { id: 'a', label: '书签', value: 'bookmark' },
      { id: 'b', label: '记不清', value: "I don't remember" },
      { id: 'c', label: 'trust', value: 'trust' }
    ]
    expect(
      filterRecallFollowUpChipsByCutPower(chips, {
        totalRankedCount: 1,
        topPick: null,
        alsoPossible: [match(bookmark('11111111-1111-4111-8111-111111111111', 'Trust'))]
      })
    ).toEqual([])

    const kept = filterRecallFollowUpChipsByCutPower(chips, {
      totalRankedCount: 2,
      topPick: null,
      alsoPossible: [
        match(bookmark('11111111-1111-4111-8111-111111111111', 'Trust news')),
        match(excerpt('22222222-2222-4222-8222-222222222222', 'other text'))
      ]
    })
    expect(kept.map(chip => chip.value)).toEqual(['bookmark', 'trust'])
  })
})
