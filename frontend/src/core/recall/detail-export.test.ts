import { describe, expect, it } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  buildDetailExport,
  parseDetailExport,
  renderDetailExportMarkdown,
  validateDetailExportSelectionCount
} from '@/core/recall/detail-export'

const excerpt: MemoryItem = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'text_excerpt',
  createdAt: '2026-08-27T12:00:00.000Z',
  updatedAt: '2026-08-27T12:00:00.000Z',
  payload: {
    sourceUrl: 'https://example.com/a',
    selectedText: 'Hello world',
    pageTitle: 'Example',
    domain: 'example.com'
  },
  clues: {}
}

describe('detail-export', () => {
  it('validateDetailExportSelectionCount 至少 1 条', () => {
    expect(validateDetailExportSelectionCount(0)).toBe(false)
    expect(validateDetailExportSelectionCount(1)).toBe(true)
    expect(validateDetailExportSelectionCount(12)).toBe(true)
  })

  it('buildDetailExport 含摘录字段', () => {
    const pack = buildDetailExport([excerpt], '2026-08-27T12:00:00.000Z')
    expect(pack.items).toHaveLength(1)
    expect(pack.items[0]?.type).toBe('text_excerpt')
    expect(() => parseDetailExport(pack)).not.toThrow()
  })

  it('renderDetailExportMarkdown 标题为 detail export', () => {
    const pack = buildDetailExport([excerpt, excerpt], '2026-08-27T12:00:00.000Z')
    const md = renderDetailExportMarkdown(pack)
    expect(md.startsWith('# Yiveno detail export')).toBe(true)
  })
})
