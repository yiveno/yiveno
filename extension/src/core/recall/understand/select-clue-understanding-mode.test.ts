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

  it('有 completer：非 URL 一律 semantic（一次听懂）', () => {
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

  it('无 completer：一律 lexical（降级垫片；禁止伪 semantic）', () => {
    expect(selectClueUnderstandingMode('Cloudflare Workers')).toBe('lexical')
    expect(selectClueUnderstandingMode('The movie that I watched yesterday')).toBe('lexical')
    expect(selectClueUnderstandingMode('the movie from day before yesterday')).toBe('lexical')
    expect(selectClueUnderstandingMode('')).toBe('lexical')
  })
})
