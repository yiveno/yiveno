import { describe, expect, it } from 'vitest'

import {
  normalizeTextExcerptSelection,
  TEXT_EXCERPT_SELECTED_TEXT_MAX_LENGTH
} from '@/core/capture/text-excerpt-selection'

describe('text-excerpt-selection', () => {
  it('normalizeTextExcerptSelection 去除空白并保留上下文', () => {
    const result = normalizeTextExcerptSelection({
      selectedText: '  关键段落  ',
      contextBefore: ' 前文… ',
      contextAfter: ' 后文… '
    })

    expect(result).toEqual({
      selectedText: '关键段落',
      contextBefore: '前文…',
      contextAfter: '后文…'
    })
  })

  it('空选区返回 null', () => {
    expect(normalizeTextExcerptSelection({ selectedText: '   ' })).toBeNull()
  })

  it('超长选区会被截断', () => {
    const longText = 'a'.repeat(TEXT_EXCERPT_SELECTED_TEXT_MAX_LENGTH + 50)
    const result = normalizeTextExcerptSelection({ selectedText: longText })
    expect(result?.selectedText).toHaveLength(TEXT_EXCERPT_SELECTED_TEXT_MAX_LENGTH)
  })
})
