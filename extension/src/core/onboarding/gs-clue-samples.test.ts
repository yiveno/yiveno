import { describe, expect, it } from 'vitest'

import {
  parseGsClueSamplesList,
  pickNextDistinctClueIndex,
  pickNextRandomClueIndex
} from '@/core/onboarding/gs-clue-samples'

describe('gs-clue-samples', () => {
  it('parseGsClueSamplesList 接受 1–4 条', () => {
    expect(parseGsClueSamplesList({ clues: ['a short oral clue here'] })).toEqual([
      'a short oral clue here'
    ])
    expect(parseGsClueSamplesList({ clues: ['one', 'two', 'three', 'four'] })).toHaveLength(4)
    expect(parseGsClueSamplesList({ clues: [] })).toBeNull()
  })

  it('pickNextRandomClueIndex 单条恒为 0；多条避开当前', () => {
    expect(pickNextRandomClueIndex(0, 1)).toBe(0)
    for (let i = 0; i < 20; i += 1) {
      const next = pickNextRandomClueIndex(2, 4)
      expect(next).not.toBe(2)
      expect(next).toBeGreaterThanOrEqual(0)
      expect(next).toBeLessThan(4)
    }
  })

  it('pickNextDistinctClueIndex 跳过相同文案', () => {
    const clues = ['same', 'same', 'other', 'same']
    expect(pickNextDistinctClueIndex(0, clues, () => 1)).toBe(2)
    expect(pickNextDistinctClueIndex(2, clues, () => 0)).toBe(0)
  })
})
