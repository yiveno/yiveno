import { describe, expect, it } from 'vitest'

import {
  applyPageContextToMatches,
  CURRENT_TAB_DOMAIN_BOOST
} from '@/application/recall/apply-recall-context'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch } from '@/core/recall/recall-result'

function matchWithDomain(id: string, domain: string, score: number): RecallMatch {
  return {
    item: {
      id,
      clues: { domain }
    } as MemoryItem,
    score,
    matchedFields: ['title']
  }
}

describe('applyPageContextToMatches', () => {
  const pool = [matchWithDomain('a', 'example.com', 10), matchWithDomain('b', 'other.com', 20)]

  it('none：不改动', () => {
    const out = applyPageContextToMatches(pool, {
      pageContextMode: 'none',
      currentTabDomain: 'example.com'
    })
    expect(out).toEqual(pool)
  })

  it('boost：同域抬分', () => {
    const out = applyPageContextToMatches(pool, {
      pageContextMode: 'boost',
      currentTabDomain: 'example.com'
    })
    expect(out.find(m => m.item.id === 'a')?.score).toBe(10 + CURRENT_TAB_DOMAIN_BOOST)
    expect(out.find(m => m.item.id === 'b')?.score).toBe(20)
  })

  it('restrict：只留同域', () => {
    const out = applyPageContextToMatches(pool, {
      pageContextMode: 'restrict',
      currentTabDomain: 'example.com'
    })
    expect(out.map(m => m.item.id)).toEqual(['a'])
  })
})
