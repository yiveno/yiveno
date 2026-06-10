import { describe, expect, it } from 'vitest'
import type { BookmarkOperation } from '@/application/bookmark/bookmark-diff-service'
import { bookmarkDiffService } from '@/application/bookmark/bookmark-diff-service'
import type { BookmarkNode } from '@/types'

describe('bookmark-diff-service.postProcessManagementProposalDiff', () => {
  const proposalChildren: BookmarkNode[] = [
    {
      id: '1',
      title: '书签栏',
      children: [
        {
          id: 'temp_1',
          title: '新建夹',
          parentId: '1',
          index: 0,
          children: [
            {
              id: 'bm-moved',
              title: 'Moved',
              url: 'https://moved.example',
              parentId: 'temp_1',
              index: 0
            }
          ]
        }
      ]
    }
  ]

  it('应过滤虚拟根、系统节点与临时书签 create，保留 temp 文件夹 create', () => {
    const operations: BookmarkOperation[] = [
      {
        type: 'create',
        nodeId: 'virtual-root',
        title: 'Root',
        isFolder: true,
        parentId: '0',
        index: 0
      },
      {
        type: 'delete',
        nodeId: '1',
        title: '书签栏',
        isFolder: true,
        parentId: '0'
      },
      {
        type: 'create',
        nodeId: 'temp_1',
        title: '新建夹',
        isFolder: true,
        parentId: '1',
        index: 0
      },
      {
        type: 'create',
        nodeId: 'temp_2',
        title: '临时书签',
        isFolder: false,
        parentId: '1',
        index: 1
      },
      {
        type: 'move',
        nodeId: 'bm-moved',
        title: 'Moved',
        isFolder: false,
        fromParentId: '1',
        toParentId: 'temp_1',
        fromIndex: 0,
        toIndex: 0,
        isSameParent: false
      },
      {
        type: 'edit',
        nodeId: 'temp_1',
        title: '新建夹',
        isFolder: true,
        oldTitle: '旧名',
        newTitle: '新建夹'
      }
    ]

    const result = bookmarkDiffService.postProcessManagementProposalDiff(
      {
        operations,
        statistics: {
          total: operations.length,
          create: 2,
          move: 1,
          edit: 1,
          delete: 1,
          newFolders: 1,
          newBookmarks: 1
        }
      },
      proposalChildren
    )

    expect(result.operations.map(op => `${op.type}:${op.nodeId}`)).toEqual([
      'create:temp_1',
      'move:bm-moved'
    ])
    expect(result.statistics).toEqual({
      total: 2,
      create: 1,
      move: 1,
      edit: 0,
      delete: 0,
      newFolders: 1,
      newBookmarks: 0
    })
  })
})
