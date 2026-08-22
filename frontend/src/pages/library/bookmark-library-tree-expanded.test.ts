import { describe, expect, it } from 'vitest'

import type { BookmarkLibraryTreeNode } from '@/core/memory/bookmark-library-tree'
import { collectDefaultExpandedFolderIds } from '@/pages/library/bookmark-library-tree-expanded'
import { resolveBookmarkFolderExpanded } from '@/pages/library/bookmark-library-tree-context'

const sampleRoots: BookmarkLibraryTreeNode[] = [
  {
    kind: 'folder',
    chromeId: 'root',
    title: 'Bookmarks bar',
    children: [
      {
        kind: 'folder',
        chromeId: 'nested',
        title: 'Work',
        children: [
          {
            kind: 'bookmark',
            chromeId: 'leaf',
            title: 'Example',
            url: 'https://example.com'
          }
        ]
      }
    ]
  }
]

describe('bookmark-library-tree-expanded', () => {
  it('默认仅展开顶层文件夹', () => {
    const ids = collectDefaultExpandedFolderIds(sampleRoots)
    expect(ids.has('root')).toBe(true)
    expect(ids.has('nested')).toBe(false)
  })

  it('resolveBookmarkFolderExpanded：null 时 depth<1 展开', () => {
    expect(resolveBookmarkFolderExpanded(null, 'root', 0)).toBe(true)
    expect(resolveBookmarkFolderExpanded(null, 'nested', 1)).toBe(false)
  })

  it('resolveBookmarkFolderExpanded：Set 为准', () => {
    const expanded = new Set(['nested'])
    expect(resolveBookmarkFolderExpanded(expanded, 'root', 0)).toBe(false)
    expect(resolveBookmarkFolderExpanded(expanded, 'nested', 1)).toBe(true)
  })
})
