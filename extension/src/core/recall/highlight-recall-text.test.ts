import { describe, expect, it } from 'vitest'

import { createTextExcerptMemoryItem } from '@/core/memory/create-memory-item'
import {
  buildRecallCardHighlightParts,
  resolveRecallHighlightSurface,
  splitTextByHighlight
} from '@/core/recall/highlight-recall-text'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

describe('highlight-recall-text', () => {
  it('splitTextByHighlight 保留原文大小写并标记命中', () => {
    expect(splitTextByHighlight('Deep RED White', 'red')).toEqual([
      { text: 'Deep ', hit: false },
      { text: 'RED', hit: true },
      { text: ' White', hit: false }
    ])
  })

  it('pageTitle 主因高亮落在 subtitle', () => {
    expect(resolveRecallHighlightSurface('pageTitle', 'text_excerpt')).toBe('subtitle')

    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Sequence still matters.',
        sourceUrl: 'https://www.gushiwen.cn/x',
        pageTitle: 'Poetry archive'
      }
    })

    const parts = buildRecallCardHighlightParts({
      clue: 'poetry',
      matchedFields: ['pageTitle'],
      item,
      title: '',
      subtitle: 'Poetry archive · www.gushiwen.cn',
      excerpt: 'Sequence still matters.'
    })

    expect(parts.surface).toBe('subtitle')
    expect(parts.subtitleParts.some(part => part.hit && part.text === 'Poetry')).toBe(true)
    expect(parts.excerptParts.every(part => !part.hit)).toBe(true)
  })
})
