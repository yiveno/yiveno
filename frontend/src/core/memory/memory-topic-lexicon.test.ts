import { describe, expect, it } from 'vitest'

import { detectTopicsFromText, expandRecallContentTerms } from '@/core/memory/memory-topic-lexicon'

describe('detectTopicsFromText', () => {
  it('Hitler title -> wwii keywords + Hitler entity', () => {
    const result = detectTopicsFromText('Hitler still casts a shadow on Europe - BBC News')
    expect(result.keywords).toEqual(expect.arrayContaining(['wwii', 'world war ii']))
    expect(result.entities).toEqual(expect.arrayContaining(['Hitler', 'BBC']))
  })

  it('wwii topic does not force Hitler entity', () => {
    const result = detectTopicsFromText('wwii documentary clips')
    expect(result.keywords).toEqual(expect.arrayContaining(['wwii']))
    expect(result.entities).not.toContain('Hitler')
  })

  it('Changchun + economic growth -> economy + Changchun', () => {
    const result = detectTopicsFromText('Is Changchun losing economic growth momentum?')
    expect(result.keywords).toEqual(expect.arrayContaining(['economy', 'city', 'growth']))
    expect(result.entities).toContain('Changchun')
  })
})

describe('expandRecallContentTerms', () => {
  it('wwii expands to canonical forms while keeping original term', () => {
    expect(expandRecallContentTerms(['wwii'])).toEqual(['wwii', 'world war ii'])
  })

  it('changchun expands to canonical entity', () => {
    expect(expandRecallContentTerms(['changchun'])).toEqual(['changchun'])
  })
})
