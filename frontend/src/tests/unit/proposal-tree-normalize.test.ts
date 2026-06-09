import { describe, expect, it } from 'vitest'
import {
  pruneEmptiedLegacyBookmarksBarFolders,
  isNodeUnderProposalNewFolderSubtree
} from '@/application/bookmark/proposal-tree-normalize'
import type { BookmarkNode } from '@/types'

describe('proposal-tree-normalize', () => {
  const originalRoots: BookmarkNode[] = [
    {
      id: '1',
      title: '书签栏',
      parentId: '0',
      children: [
        {
          id: 'old-folder',
          title: '旧目录',
          parentId: '1',
          index: 0,
          children: [
            {
              id: 'bm-1',
              title: 'A',
              url: 'https://a.example.com',
              parentId: 'old-folder',
              index: 0
            }
          ]
        }
      ]
    }
  ]

  it('手动编辑：书签移入 temp_* 后移除已搬空的旧目录', () => {
    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          {
            id: 'temp_1',
            title: '新建文件夹',
            parentId: '1',
            index: 0,
            children: [
              {
                id: 'bm-1',
                title: 'A',
                url: 'https://a.example.com',
                parentId: 'temp_1',
                index: 0
              }
            ]
          },
          {
            id: 'old-folder',
            title: '旧目录',
            parentId: '1',
            index: 1,
            children: []
          }
        ]
      }
    ]

    const normalized = pruneEmptiedLegacyBookmarksBarFolders(proposal, originalRoots)
    const bar = normalized.find(n => n.id === '1')
    expect(bar?.children?.map(c => c.id)).toEqual(['temp_1'])
    expect(bar?.children?.[0]?.children?.[0]?.id).toBe('bm-1')
  })

  it('未参与整理的书签仍留在旧目录时不 prune', () => {
    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          {
            id: 'temp_1',
            title: '新建',
            parentId: '1',
            children: [
              {
                id: 'bm-1',
                url: 'https://a.example.com',
                title: 'A',
                parentId: 'temp_1',
                index: 0
              }
            ]
          },
          {
            id: 'old-folder',
            title: '旧目录',
            parentId: '1',
            children: [
              {
                id: 'bm-2',
                title: 'B',
                url: 'https://b.example.com',
                parentId: 'old-folder',
                index: 0
              }
            ]
          }
        ]
      }
    ]

    const originalWithTwo: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: 'old-folder',
            title: '旧目录',
            parentId: '1',
            children: [
              { id: 'bm-1', title: 'A', url: 'https://a.example.com', parentId: 'old-folder' },
              { id: 'bm-2', title: 'B', url: 'https://b.example.com', parentId: 'old-folder' }
            ]
          }
        ]
      }
    ]

    const normalized = pruneEmptiedLegacyBookmarksBarFolders(proposal, originalWithTwo)
    const bar = normalized.find(n => n.id === '1')
    expect(bar?.children?.some(c => c.id === 'old-folder')).toBe(true)
  })

  it('isNodeUnderProposalNewFolderSubtree 识别 temp_* 与 temp_ai_*', () => {
    const map = new Map([
      ['temp_1', { parentId: '1' }],
      ['bm-manual', { parentId: 'temp_1' }],
      ['temp_ai_1', { parentId: '1' }],
      ['bm-ai', { parentId: 'temp_ai_1' }]
    ])

    expect(isNodeUnderProposalNewFolderSubtree('bm-manual', map)).toBe(true)
    expect(isNodeUnderProposalNewFolderSubtree('bm-ai', map)).toBe(true)
    expect(isNodeUnderProposalNewFolderSubtree('bm-other', map)).toBe(false)
  })
})
