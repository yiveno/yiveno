import { describe, expect, it } from 'vitest'

import { buildClueEmbeddingText } from '@/core/recall/build-clue-embedding-text'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

describe('buildClueEmbeddingText', () => {
  it('有锚点词时只拼锚点 + movie 提示，不拼整句口语', () => {
    const parsed = {
      raw: 'the atomic bomb movie review I saved',
      contentTerms: ['atomic', 'bomb', 'review'],
      objectTypes: ['video'],
      confidence: 'medium'
    } as ParsedRecallClue
    expect(
      buildClueEmbeddingText({
        effectiveClue: 'the atomic bomb movie review I saved',
        parsed,
        rawClue: 'the atomic bomb movie review I saved'
      })
    ).toBe('atomic bomb movie')
  })

  it('无 contentTerms 时退回 effectiveClue', () => {
    expect(
      buildClueEmbeddingText({
        effectiveClue: 'gregory peck million pound',
        rawClue: 'fallback'
      })
    ).toBe('gregory peck million pound')
  })
})
