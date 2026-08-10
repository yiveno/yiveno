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

  it('有 completer：口语 / 短词 / 中文一律 semantic（一次听懂）', () => {
    expect(
      selectClueUnderstandingMode('The movie that I watched yesterday', {
        hasLlmCompleter: true
      })
    ).toBe('semantic')
    expect(selectClueUnderstandingMode('Cloudflare Workers', { hasLlmCompleter: true })).toBe(
      'semantic'
    )
    expect(selectClueUnderstandingMode('电影', { hasLlmCompleter: true })).toBe('semantic')
    expect(selectClueUnderstandingMode('前天的电影', { hasLlmCompleter: true })).toBe('semantic')
  })

  it('无 completer：短英文专名 lexical；长口语标 semantic（仍走规则执行）', () => {
    expect(selectClueUnderstandingMode('Cloudflare Workers')).toBe('lexical')
    expect(selectClueUnderstandingMode('The movie that I watched yesterday')).toBe('semantic')
    expect(selectClueUnderstandingMode('前天的电影')).toBe('semantic')
  })
})
