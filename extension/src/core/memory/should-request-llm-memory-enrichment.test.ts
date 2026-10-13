import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  evaluateLlmMemoryEnrichmentGate,
  shouldRequestLlmMemoryEnrichment
} from '@/core/memory/should-request-llm-memory-enrichment'

describe('shouldRequestLlmMemoryEnrichment', () => {
  it('有 summary 则跳过', () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Hitler documentary', url: 'https://youtube.com/watch?v=1' },
      clues: { summary: 'already enriched' }
    })
    expect(evaluateLlmMemoryEnrichmentGate(item)).toEqual({
      shouldRequest: false,
      reason: 'has_summary'
    })
  })

  it('标题过短则跳过', () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'ab', url: 'https://example.com/x' }
    })
    expect(shouldRequestLlmMemoryEnrichment(item)).toBe(false)
    expect(evaluateLlmMemoryEnrichmentGate(item).reason).toBe('signal_too_short')
  })

  it('摘录有足够正文则放行', () => {
    const item = createTextExcerptMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: {
        selectedText: 'Will Changchun become a bankrupt capital city?',
        sourceUrl: 'https://example.com/a',
        pageTitle: 'page'
      }
    })
    expect(shouldRequestLlmMemoryEnrichment(item)).toBe(true)
  })
})
