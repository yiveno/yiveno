import { describe, expect, it } from 'vitest'

import { selectClueUnderstandingMode } from '@/core/recall/understand/select-clue-understanding-mode'

describe('selectClueUnderstandingMode', () => {
  it('短专名 / URL → lexical', () => {
    expect(selectClueUnderstandingMode('Cloudflare Workers')).toBe('lexical')
    expect(selectClueUnderstandingMode('github.com/cqw')).toBe('lexical')
    expect(selectClueUnderstandingMode('https://example.com/a')).toBe('lexical')
  })

  it('长口语 / 疑问 → semantic', () => {
    expect(
      selectClueUnderstandingMode(
        "I recently came across a news article about a legal case. I've forgotten all the other details. Could you please help me find it?"
      )
    ).toBe('semantic')
    expect(selectClueUnderstandingMode('The movie that I watched yesterday')).toBe('semantic')
  })
})
