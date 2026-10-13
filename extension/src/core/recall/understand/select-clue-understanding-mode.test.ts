import { describe, expect, it } from 'vitest'

import { selectClueUnderstandingMode } from '@/core/recall/understand/select-clue-understanding-mode'

describe('selectClueUnderstandingMode', () => {
  it('纯 URL → lexical（有无 completer 皆然）', () => {
    expect(selectClueUnderstandingMode('https://example.com/a')).toBe('lexical')
    expect(selectClueUnderstandingMode('https://example.com/a', { hasLlmCompleter: true })).toBe(
      'lexical'
    )
    expect(selectClueUnderstandingMode('github.com/cqw')).toBe('lexical')
  })

  it('with completer: oral clues and short proper nouns stay semantic', () => {
    expect(
      selectClueUnderstandingMode('The movie that I watched yesterday', {
        hasLlmCompleter: true
      })
    ).toBe('semantic')
    expect(selectClueUnderstandingMode('Cloudflare Workers', { hasLlmCompleter: true })).toBe(
      'semantic'
    )
    expect(selectClueUnderstandingMode('movie', { hasLlmCompleter: true })).toBe('semantic')
    expect(
      selectClueUnderstandingMode('the movie from day before yesterday', { hasLlmCompleter: true })
    ).toBe('semantic')
  })

  it('without completer: short proper nouns stay lexical; longer oral clues are semantic', () => {
    expect(selectClueUnderstandingMode('Cloudflare Workers')).toBe('lexical')
    expect(selectClueUnderstandingMode('The movie that I watched yesterday')).toBe('semantic')
    expect(selectClueUnderstandingMode('the movie from day before yesterday')).toBe('semantic')
  })
})
