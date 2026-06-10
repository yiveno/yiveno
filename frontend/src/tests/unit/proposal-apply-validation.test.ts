import { describe, expect, it } from 'vitest'
import type { BookmarkOperation } from '@/application/bookmark/bookmark-diff-service'
import { validateProposalBeforeApply } from '@/application/bookmark/proposal-apply-validation'
import type { BookmarkNode } from '@/types'

describe('proposal-apply-validation', () => {
  const originalMap = new Map<string, BookmarkNode>([
    [
      'bm-1',
      {
        id: 'bm-1',
        title: 'Example',
        url: 'https://example.com',
        parentId: '1',
        index: 0
      }
    ]
  ])

  const proposalRoots: BookmarkNode[] = [
    {
      id: '1',
      title: '书签栏',
      parentId: '0',
      index: 0,
      children: [
        {
          id: 'temp_1',
          title: '新建文件夹',
          parentId: '1',
          index: 0,
          children: [
            {
              id: 'bm-1',
              title: 'Example',
              url: 'https://example.com',
              parentId: 'temp_1',
              index: 0
            }
          ]
        }
      ]
    }
  ]

  it('合法 temp 文件夹与移动应通过校验', () => {
    const operations: BookmarkOperation[] = [
      {
        type: 'create',
        nodeId: 'temp_1',
        title: '新建文件夹',
        isFolder: true,
        parentId: '1',
        index: 0
      },
      {
        type: 'move',
        nodeId: 'bm-1',
        title: 'Example',
        isFolder: false,
        fromParentId: '1',
        toParentId: 'temp_1',
        fromIndex: 0,
        toIndex: 0,
        isSameParent: false
      }
    ]

    const result = validateProposalBeforeApply(operations, proposalRoots, originalMap)
    expect(result.ok).toBe(true)
  })

  it('左侧已不存在的节点应校验失败', () => {
    const operations: BookmarkOperation[] = [
      {
        type: 'move',
        nodeId: 'missing-id',
        title: 'Ghost',
        isFolder: false,
        fromParentId: '1',
        toParentId: '1',
        fromIndex: 0,
        toIndex: 0,
        isSameParent: true
      }
    ]

    const result = validateProposalBeforeApply(operations, proposalRoots, originalMap)
    expect(result.ok).toBe(false)
    expect(result.issues.some(issue => issue.code === 'MISSING_ORIGINAL_NODE')).toBe(true)
  })

  it('移动到虚拟根 root 应通过校验', () => {
    const operations: BookmarkOperation[] = [
      {
        type: 'move',
        nodeId: 'bm-1',
        title: 'Example',
        isFolder: false,
        fromParentId: '1',
        toParentId: 'root',
        fromIndex: 0,
        toIndex: 1,
        isSameParent: false
      }
    ]

    const result = validateProposalBeforeApply(operations, proposalRoots, originalMap)
    expect(result.ok).toBe(true)
  })

  it('移动目标文件夹不存在时应校验失败', () => {
    const operations: BookmarkOperation[] = [
      {
        type: 'move',
        nodeId: 'bm-1',
        title: 'Example',
        isFolder: false,
        fromParentId: '1',
        toParentId: 'missing-folder',
        fromIndex: 0,
        toIndex: 0,
        isSameParent: false
      }
    ]

    const result = validateProposalBeforeApply(operations, proposalRoots, originalMap)
    expect(result.ok).toBe(false)
    expect(result.issues.some(issue => issue.code === 'MISSING_MOVE_TARGET')).toBe(true)
  })

  it('断裂的 temp 父链应校验失败', () => {
    const brokenProposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: 'temp_2',
            title: '孤儿文件夹',
            parentId: 'temp_99',
            index: 0,
            children: []
          }
        ]
      }
    ]

    const operations: BookmarkOperation[] = [
      {
        type: 'create',
        nodeId: 'temp_2',
        title: '孤儿文件夹',
        isFolder: true,
        parentId: 'temp_99',
        index: 0
      }
    ]

    const result = validateProposalBeforeApply(operations, brokenProposal, originalMap)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some(issue =>
        ['BROKEN_TEMP_CHAIN', 'BROKEN_TEMP_PARENT_CHAIN', 'MISSING_TEMP_PARENT'].includes(
          issue.code
        )
      )
    ).toBe(true)
  })
})
