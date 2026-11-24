import { describe, expect, it } from 'vitest'

import type { BookmarkLibraryVisibleRow } from '@/core/memory/bookmark-library-index'
import {
  buildBookmarkLibraryRowMemoDeps,
  type BookmarkLibraryRowMemoContext
} from '@/pages/library/bookmark-library-tree-row-memo'

function baseBookmarkRow(
  overrides: Partial<BookmarkLibraryVisibleRow> = {}
): BookmarkLibraryVisibleRow {
  return {
    kind: 'bookmark',
    chromeId: 'bm-1',
    depth: 1,
    title: 'Title',
    url: 'https://example.com',
    memoryItemId: '11111111-1111-4111-8111-111111111111',
    hasNote: false,
    note: 'note',
    savedAt: '2026-07-22T06:00:00.000Z',
    ...overrides
  }
}

const baseCtx: BookmarkLibraryRowMemoContext = {
  showDetailExportSelection: false,
  detailExportSelectionRevision: 0,
  exportSelected: false,
  deletingId: null,
  showUnsyncedFlags: true
}

describe('buildBookmarkLibraryRowMemoDeps', () => {
  it('note 变化 → 依赖数组变化', () => {
    const a = buildBookmarkLibraryRowMemoDeps(baseBookmarkRow({ note: 'a' }), baseCtx)
    const b = buildBookmarkLibraryRowMemoDeps(baseBookmarkRow({ note: 'b' }), baseCtx)
    expect(a).not.toEqual(b)
  })

  it('expanded 变化 → 依赖数组变化', () => {
    const folder: BookmarkLibraryVisibleRow = {
      kind: 'folder',
      chromeId: 'f-1',
      depth: 0,
      title: 'Folder',
      hasNote: false,
      expanded: false
    }
    const a = buildBookmarkLibraryRowMemoDeps(folder, baseCtx)
    const b = buildBookmarkLibraryRowMemoDeps({ ...folder, expanded: true }, baseCtx)
    expect(a).not.toEqual(b)
  })

  it('title 变化 → 依赖数组变化', () => {
    const a = buildBookmarkLibraryRowMemoDeps(baseBookmarkRow({ title: 'A' }), baseCtx)
    const b = buildBookmarkLibraryRowMemoDeps(baseBookmarkRow({ title: 'B' }), baseCtx)
    expect(a).not.toEqual(b)
  })

  it('deletingId 命中该行 → 依赖数组变化', () => {
    const row = baseBookmarkRow()
    const a = buildBookmarkLibraryRowMemoDeps(row, { ...baseCtx, deletingId: null })
    const b = buildBookmarkLibraryRowMemoDeps(row, {
      ...baseCtx,
      deletingId: row.memoryItemId ?? null
    })
    expect(a).not.toEqual(b)
  })

  it('输入完全相同 → 数组逐项相等', () => {
    const row = baseBookmarkRow()
    const a = buildBookmarkLibraryRowMemoDeps(row, baseCtx)
    const b = buildBookmarkLibraryRowMemoDeps(row, baseCtx)
    expect(a).toHaveLength(15)
    expect(a).toEqual(b)
  })
})
