import { describe, expect, it } from 'vitest'

import {
  buildPropositionEmbeddingText,
  DREAMING_PROPOSITION_EMBED_TEXT_MAX_CHARS
} from '@/core/dreaming/build-proposition-embedding-text'

describe('buildPropositionEmbeddingText', () => {
  it('按 §10 契约拼接 text + sourceQuote，总量 ≤1000', () => {
    const text = 'A'.repeat(400)
    const quote = 'B'.repeat(500)
    const out = buildPropositionEmbeddingText({ text, sourceQuote: quote })
    expect(out).toBe(`${text}\n${quote}`)
    expect(out.length).toBeLessThanOrEqual(DREAMING_PROPOSITION_EMBED_TEXT_MAX_CHARS)
  })

  it('空正文返回空串', () => {
    expect(buildPropositionEmbeddingText({ text: '  ', sourceQuote: 'x' })).toBe('')
  })
})
