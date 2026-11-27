import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CLUE_CHAIN_FIXTURE_FILES,
  loadClueChainCasesFromFixtures,
  parseClueChainCasesJson
} from './load-cases'

describe('clue-chain load-cases', () => {
  it('加载 70 条 fixture（20+50）', () => {
    const { cases, fixtureFiles } = loadClueChainCasesFromFixtures(DEFAULT_CLUE_CHAIN_FIXTURE_FILES)
    expect(cases).toHaveLength(70)
    expect(fixtureFiles).toHaveLength(2)
    expect(cases.some(item => item.id === '01')).toBe(true)
    expect(cases.some(item => item.id === 'A01')).toBe(true)
    expect(cases.filter(item => item.category === 'C')).toHaveLength(8)
  })

  it('拒绝畸形 JSON', () => {
    expect(() => parseClueChainCasesJson([{ id: 'x' }], 'bad')).toThrow(/无效/)
  })
})
