import { describe, expect, it } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  formatGettingStartedExcerptSnippet,
  listGettingStartedExcerptSuggestions,
  resolveGettingStartedExcerptSuggestions
} from '@/pages/getting-started/pick-getting-started-excerpt-sample'

function excerpt(id: string, text: string, updatedAt: string): MemoryItem {
  return {
    id,
    ownerId: '00000000-0000-4000-8000-000000000001',
    sourceLocalProfileId: '00000000-0000-4000-8000-000000000002',
    type: 'text_excerpt',
    clues: { keywords: [], entities: [], tags: [], openCount: 0, settledCount: 0, dismissCount: 0 },
    createdAt: updatedAt,
    updatedAt,
    payload: {
      selectedText: text,
      sourceUrl: 'https://example.com/a',
      pageTitle: 'Example',
      domain: 'example.com'
    }
  }
}

describe('pick-getting-started-excerpt-sample', () => {
  it('formatGettingStartedExcerptSnippet 截断过长正文', () => {
    const long = 'a'.repeat(80)
    const out = formatGettingStartedExcerptSnippet(long)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(48)
  })

  it('近者优先、模板轮换、去重', () => {
    const items = [
      excerpt('00000000-0000-4000-8000-000000000010', 'older line', '2026-01-01T00:00:00.000Z'),
      excerpt('00000000-0000-4000-8000-000000000011', 'newer line', '2026-06-01T00:00:00.000Z'),
      excerpt('00000000-0000-4000-8000-000000000012', 'newer line', '2026-06-02T00:00:00.000Z')
    ]
    const samples = listGettingStartedExcerptSuggestions(items, 3)
    expect(samples[0]?.clue).toContain('newer line')
    expect(samples.length).toBe(2)
  })

  it('无摘录时 fallback', () => {
    expect(resolveGettingStartedExcerptSuggestions([], 'something I highlighted')).toEqual([
      { title: '', clue: 'something I highlighted' }
    ])
  })
})
