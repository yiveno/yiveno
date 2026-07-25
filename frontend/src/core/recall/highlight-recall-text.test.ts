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
        selectedText: '先后仍须次第',
        sourceUrl: 'https://www.gushiwen.cn/x',
        pageTitle: '古文岛-原古诗文网'
      }
    })

    const parts = buildRecallCardHighlightParts({
      clue: '古诗',
      matchedFields: ['pageTitle'],
      item,
      title: '',
      subtitle: '古文岛-原古诗文网 · www.gushiwen.cn',
      excerpt: '先后仍须次第'
    })

    expect(parts.surface).toBe('subtitle')
    expect(parts.subtitleParts.some(part => part.hit && part.text === '古诗')).toBe(true)
    expect(parts.excerptParts.every(part => !part.hit)).toBe(true)
  })
})
