import { describe, expect, it } from 'vitest'

import {
  countBookmarkLibraryLeaves,
  mapChromeBookmarkTreeToLibraryForest
} from '@/core/memory/bookmark-library-tree'

describe('bookmark-library-tree', () => {
  it('映射完整文件夹层级并挂上 memoryItemId', () => {
    const memoryId = '11111111-1111-4111-8111-111111111111'
    const forest = mapChromeBookmarkTreeToLibraryForest(
      [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: '书签栏',
              children: [
                {
                  id: '10',
                  title: '工作',
                  children: [
                    { id: '100', title: '留存分析', url: 'https://example.com/retention' },
                    { id: '101', title: '内部', url: 'chrome://settings' }
                  ]
                }
              ]
            },
            {
              id: '2',
              title: '其他书签',
              children: []
            }
          ]
        }
      ],
      new Map([['100', memoryId]]),
      { unnamedFolderTitle: 'Unnamed folder' }
    )

    expect(forest).toHaveLength(2)
    expect(forest[0]).toMatchObject({ kind: 'folder', title: '书签栏' })
    expect(forest[1]).toMatchObject({ kind: 'folder', title: '其他书签', children: [] })

    const work = forest[0]?.kind === 'folder' ? forest[0].children[0] : null
    expect(work).toMatchObject({ kind: 'folder', title: '工作' })
    if (work?.kind !== 'folder') {
      throw new Error('expected folder')
    }
    expect(work.children).toHaveLength(1)
    expect(work.children[0]).toEqual({
      kind: 'bookmark',
      chromeId: '100',
      title: '留存分析',
      url: 'https://example.com/retention',
      memoryItemId: memoryId
    })
    expect(countBookmarkLibraryLeaves(forest)).toBe(1)
  })

  it('无标题文件夹使用调用方注入文案', () => {
    const forest = mapChromeBookmarkTreeToLibraryForest(
      [
        {
          id: '0',
          title: 'Root',
          children: [
            {
              id: '1',
              title: '  ',
              children: [{ id: '10', title: 'A', url: 'https://example.com/a' }]
            }
          ]
        }
      ],
      new Map(),
      { unnamedFolderTitle: 'Unnamed folder' }
    )

    expect(forest).toEqual([
      {
        kind: 'folder',
        chromeId: '0',
        title: 'Root',
        children: [
          {
            kind: 'folder',
            chromeId: '1',
            title: 'Unnamed folder',
            children: [
              {
                kind: 'bookmark',
                chromeId: '10',
                title: 'A',
                url: 'https://example.com/a'
              }
            ]
          }
        ]
      }
    ])
  })
})
