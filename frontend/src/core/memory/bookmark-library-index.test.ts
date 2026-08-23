import { describe, expect, it } from 'vitest'

import { buildSyntheticChromeBookmarkTree } from '@/core/memory/bookmark-library-fixture'
import {
  buildBookmarkLibraryNodeMap,
  computeBookmarkLibraryStructureHash,
  flattenBookmarkLibraryVisibleRows,
  mapChromeBookmarkTreeToLibraryIndex,
  resolveBookmarkFolderExpanded
} from '@/core/memory/bookmark-library-index'
import {
  buildBookmarkLibraryRowMetrics,
  resolveBookmarkLibraryVisibleSlice
} from '@/core/memory/bookmark-library-virtual-list'

describe('bookmark-library-index', () => {
  it('扁平索引与嵌套 forest 语义一致', () => {
    const memoryId = '11111111-1111-4111-8111-111111111111'
    const index = mapChromeBookmarkTreeToLibraryIndex(
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
                  id: '100',
                  title: 'Example',
                  url: 'https://example.com/retention'
                }
              ]
            }
          ]
        }
      ],
      new Map([['100', memoryId]]),
      {
        unnamedFolderTitle: 'Unnamed folder',
        noteByMemoryId: new Map([[memoryId, 'plan for review']])
      }
    )

    expect(index.rootIds).toEqual(['1'])
    expect(index.bookmarkCount).toBe(1)
    const bookmark = index.nodes.find(node => node.kind === 'bookmark')
    expect(bookmark).toMatchObject({
      chromeId: '100',
      memoryItemId: memoryId,
      hasNote: true,
      note: 'plan for review'
    })
  })

  it('flatten：默认仅展开顶层文件夹', () => {
    const index = mapChromeBookmarkTreeToLibraryIndex(
      [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bar',
              children: [
                {
                  id: '2',
                  title: 'Nested',
                  children: [{ id: '10', title: 'A', url: 'https://a.test' }]
                }
              ]
            }
          ]
        }
      ],
      new Map(),
      { unnamedFolderTitle: 'Unnamed' }
    )
    const nodeById = buildBookmarkLibraryNodeMap(index)
    const rows = flattenBookmarkLibraryVisibleRows(index, nodeById, null)
    expect(rows.map(row => row.title)).toEqual(['Bar', 'Nested'])
  })

  it('resolveBookmarkFolderExpanded', () => {
    expect(resolveBookmarkFolderExpanded(null, 'a', 0)).toBe(true)
    expect(resolveBookmarkFolderExpanded(null, 'a', 1)).toBe(false)
    expect(resolveBookmarkFolderExpanded(new Set(['b']), 'b', 2)).toBe(true)
  })

  it('structureHash 随附注变化', () => {
    const index = mapChromeBookmarkTreeToLibraryIndex(
      [{ id: '10', title: 'A', url: 'https://example.com/a' }],
      new Map(),
      { unnamedFolderTitle: 'Unnamed' }
    )
    const before = computeBookmarkLibraryStructureHash(index)
    const node = index.nodes[0]
    if (!node || node.kind !== 'bookmark') {
      throw new Error('expected bookmark')
    }
    node.hasNote = true
    node.note = 'changed'
    const after = computeBookmarkLibraryStructureHash(index)
    expect(after).not.toBe(before)
  })

  it('2 万书签：map + flatten + virtual slice 在预算内', () => {
    const chromeTree = buildSyntheticChromeBookmarkTree(20_000)
    const startedMap = performance.now()
    const index = mapChromeBookmarkTreeToLibraryIndex(chromeTree, new Map(), {
      unnamedFolderTitle: 'Unnamed'
    })
    const mapMs = performance.now() - startedMap
    expect(index.bookmarkCount).toBe(20_000)

    const nodeById = buildBookmarkLibraryNodeMap(index)
    const allFolderIds = new Set(
      index.nodes.filter(node => node.kind === 'folder').map(node => node.chromeId)
    )
    const startedFlatten = performance.now()
    const rows = flattenBookmarkLibraryVisibleRows(index, nodeById, allFolderIds)
    const flattenMs = performance.now() - startedFlatten
    expect(rows.length).toBeGreaterThan(20_000)

    const metrics = buildBookmarkLibraryRowMetrics(rows)
    const slice = resolveBookmarkLibraryVisibleSlice(metrics, rows.length, 0, 480, 8)
    expect(slice.end - slice.start).toBeLessThan(40)

    expect(mapMs).toBeLessThan(500)
    expect(flattenMs).toBeLessThan(200)
  })
})
