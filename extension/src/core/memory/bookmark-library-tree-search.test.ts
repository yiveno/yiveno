import { describe, expect, it } from 'vitest'

import {
  buildBookmarkLibraryNodeMap,
  mapChromeBookmarkTreeToLibraryIndex
} from '@/core/memory/bookmark-library-index'
import { flattenBookmarkLibrarySearchVisibleRows } from '@/core/memory/bookmark-library-tree-search'

function buildSampleIndex() {
  return mapChromeBookmarkTreeToLibraryIndex(
    [
      {
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: 'Bookmarks bar',
            children: [
              {
                id: '10',
                title: 'Projects',
                children: [
                  {
                    id: '100',
                    title: 'Retention plan',
                    url: 'https://example.com/retention'
                  },
                  {
                    id: '101',
                    title: 'Other note',
                    url: 'https://example.com/other'
                  }
                ]
              },
              {
                id: '11',
                title: 'Loose',
                url: 'https://loose.example.com/'
              }
            ]
          }
        ]
      }
    ],
    new Map([
      ['100', '11111111-1111-4111-8111-111111111111'],
      ['101', '22222222-2222-4222-8222-222222222222'],
      ['11', '33333333-3333-4333-8333-333333333333']
    ]),
    {
      unnamedFolderTitle: 'Unnamed folder',
      noteByMemoryId: new Map([
        ['11111111-1111-4111-8111-111111111111', 'quarterly shelf'],
        ['22222222-2222-4222-8222-222222222222', 'skip me']
      ])
    }
  )
}

describe('bookmark-library-tree-search', () => {
  it('书签标题命中：该书签 + 祖先文件夹可见', () => {
    const index = buildSampleIndex()
    const nodeById = buildBookmarkLibraryNodeMap(index)
    const rows = flattenBookmarkLibrarySearchVisibleRows(index, nodeById, 'Retention')
    expect(rows.map(row => row.chromeId)).toEqual(['1', '10', '100'])
    expect(rows.find(row => row.chromeId === '1')?.expanded).toBe(true)
    expect(rows.find(row => row.chromeId === '10')?.expanded).toBe(true)
  })

  it('文件夹标题命中：该文件夹及整子树可见', () => {
    const index = buildSampleIndex()
    const nodeById = buildBookmarkLibraryNodeMap(index)
    const rows = flattenBookmarkLibrarySearchVisibleRows(index, nodeById, 'Projects')
    expect(rows.map(row => row.chromeId)).toEqual(['1', '10', '100', '101'])
    expect(rows.find(row => row.chromeId === '10')?.expanded).toBe(true)
  })

  it('书签附注命中：祖先可见', () => {
    const index = buildSampleIndex()
    const nodeById = buildBookmarkLibraryNodeMap(index)
    const rows = flattenBookmarkLibrarySearchVisibleRows(index, nodeById, 'quarterly shelf')
    expect(rows.map(row => row.chromeId)).toEqual(['1', '10', '100'])
  })

  it('无命中返回空', () => {
    const index = buildSampleIndex()
    const nodeById = buildBookmarkLibraryNodeMap(index)
    const rows = flattenBookmarkLibrarySearchVisibleRows(index, nodeById, 'zzzz-no-hit')
    expect(rows).toEqual([])
  })
})
