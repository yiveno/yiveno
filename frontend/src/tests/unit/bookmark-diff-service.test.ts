import { describe, expect, it } from 'vitest'
import { bookmarkDiffService } from '@/application/bookmark/bookmark-diff-service'
import { calculateManagementProposalDiff } from '@/application/bookmark/management-proposal-diff'
import type { BookmarkNode } from '@/types'

function virtualRoot(children: BookmarkNode[]): BookmarkNode {
  return { id: 'virtual-root', title: 'Root', children }
}

function flattenNodes(nodes: BookmarkNode[]): Map<string, BookmarkNode> {
  const map = new Map<string, BookmarkNode>()
  const walk = (list: BookmarkNode[]) => {
    for (const node of list) {
      map.set(String(node.id), node)
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return map
}

describe('bookmark-diff-service.calculateDiff', () => {
  const barRoot: BookmarkNode = {
    id: '1',
    title: '书签栏',
    parentId: '0',
    index: 0,
    children: [
      {
        id: 'folder-a',
        title: 'A',
        parentId: '1',
        index: 0,
        children: [
          {
            id: 'bm-1',
            title: 'One',
            url: 'https://one.example',
            parentId: 'folder-a',
            index: 0
          }
        ]
      },
      {
        id: 'folder-b',
        title: 'B',
        parentId: '1',
        index: 1,
        children: []
      }
    ]
  }

  it('应检测跨文件夹移动', () => {
    const proposalBar: BookmarkNode = {
      ...barRoot,
      children: [
        { ...barRoot.children![0]!, children: [] },
        {
          ...barRoot.children![1]!,
          children: [
            {
              id: 'bm-1',
              title: 'One',
              url: 'https://one.example',
              parentId: 'folder-b',
              index: 0
            }
          ]
        }
      ]
    }

    const diff = bookmarkDiffService.calculateDiff(
      virtualRoot([barRoot]),
      virtualRoot([proposalBar]),
      { flatOriginalNodes: flattenNodes([barRoot]) }
    )

    const move = diff.operations.find(op => op.type === 'move' && op.nodeId === 'bm-1')
    expect(move).toMatchObject({
      type: 'move',
      fromParentId: 'folder-a',
      toParentId: 'folder-b',
      isSameParent: false
    })
  })

  it('应检测标题编辑', () => {
    const proposalBar: BookmarkNode = {
      ...barRoot,
      children: [
        {
          ...barRoot.children![0]!,
          children: [
            {
              id: 'bm-1',
              title: 'Renamed',
              url: 'https://one.example',
              parentId: 'folder-a',
              index: 0
            }
          ]
        },
        barRoot.children![1]!
      ]
    }

    const diff = bookmarkDiffService.calculateDiff(
      virtualRoot([barRoot]),
      virtualRoot([proposalBar]),
      { flatOriginalNodes: flattenNodes([barRoot]) }
    )

    expect(diff.operations).toContainEqual(
      expect.objectContaining({
        type: 'edit',
        nodeId: 'bm-1',
        oldTitle: 'One',
        newTitle: 'Renamed'
      })
    )
  })

  it('应检测删除书签', () => {
    const proposalBar: BookmarkNode = {
      ...barRoot,
      children: [{ ...barRoot.children![0]!, children: [] }, barRoot.children![1]!]
    }

    const diff = bookmarkDiffService.calculateDiff(
      virtualRoot([barRoot]),
      virtualRoot([proposalBar]),
      { flatOriginalNodes: flattenNodes([barRoot]) }
    )

    expect(diff.operations).toContainEqual(
      expect.objectContaining({
        type: 'delete',
        nodeId: 'bm-1',
        isFolder: false
      })
    )
  })

  it('应检测新建临时文件夹', () => {
    const proposalBar: BookmarkNode = {
      ...barRoot,
      children: [
        {
          ...barRoot.children![0]!,
          children: [
            ...(barRoot.children![0]!.children ?? []),
            {
              id: 'temp_1',
              title: '新建夹',
              parentId: 'folder-a',
              index: 1,
              children: []
            }
          ]
        },
        barRoot.children![1]!
      ]
    }

    const diff = bookmarkDiffService.calculateDiff(
      virtualRoot([barRoot]),
      virtualRoot([proposalBar]),
      { flatOriginalNodes: flattenNodes([barRoot]) }
    )

    expect(diff.operations).toContainEqual(
      expect.objectContaining({
        type: 'create',
        nodeId: 'temp_1',
        isFolder: true,
        parentId: 'folder-a'
      })
    )
  })

  it('删除文件夹时不应再单独删除其子节点', () => {
    const original: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          {
            id: 'folder-x',
            title: 'X',
            parentId: '1',
            index: 0,
            children: [
              {
                id: 'bm-child',
                title: 'Child',
                url: 'https://child.example',
                parentId: 'folder-x',
                index: 0
              }
            ]
          }
        ]
      }
    ]

    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: []
      }
    ]

    const flat = flattenNodes(original)
    const diff = bookmarkDiffService.calculateDiff(virtualRoot(original), virtualRoot(proposal), {
      flatOriginalNodes: flat
    })

    const deletes = diff.operations.filter(op => op.type === 'delete')
    expect(deletes.map(op => op.nodeId)).toEqual(['folder-x'])
  })

  it('应过滤同级整体 index 偏移造成的假移动', () => {
    const original: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          { id: 'bm-a', title: 'A', url: 'https://a.example', parentId: '1', index: 0 },
          { id: 'bm-b', title: 'B', url: 'https://b.example', parentId: '1', index: 1 },
          { id: 'bm-c', title: 'C', url: 'https://c.example', parentId: '1', index: 2 }
        ]
      }
    ]

    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          { id: 'bm-new', title: 'New', url: 'https://new.example', parentId: '1', index: 0 },
          { id: 'bm-a', title: 'A', url: 'https://a.example', parentId: '1', index: 1 },
          { id: 'bm-b', title: 'B', url: 'https://b.example', parentId: '1', index: 2 },
          { id: 'bm-c', title: 'C', url: 'https://c.example', parentId: '1', index: 3 }
        ]
      }
    ]

    const diff = bookmarkDiffService.calculateDiff(virtualRoot(original), virtualRoot(proposal), {
      flatOriginalNodes: flattenNodes(original)
    })

    const moves = diff.operations.filter(op => op.type === 'move')
    expect(moves).toHaveLength(0)
    expect(diff.operations.some(op => op.type === 'create' && op.nodeId === 'bm-new')).toBe(true)
  })

  it('应保留真实的同级顺序调换', () => {
    const original: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          { id: 'bm-a', title: 'A', url: 'https://a.example', parentId: '1', index: 0 },
          { id: 'bm-b', title: 'B', url: 'https://b.example', parentId: '1', index: 1 }
        ]
      }
    ]

    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          { id: 'bm-b', title: 'B', url: 'https://b.example', parentId: '1', index: 0 },
          { id: 'bm-a', title: 'A', url: 'https://a.example', parentId: '1', index: 1 }
        ]
      }
    ]

    const diff = bookmarkDiffService.calculateDiff(virtualRoot(original), virtualRoot(proposal), {
      flatOriginalNodes: flattenNodes(original)
    })

    const moves = diff.operations.filter(op => op.type === 'move')
    expect(moves.length).toBeGreaterThan(0)
    expect(moves.every(op => op.isSameParent)).toBe(true)
  })

  it('操作应按 delete → move → edit → create 排序', () => {
    const original: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          { id: 'bm-old', title: 'Old', url: 'https://old.example', parentId: '1', index: 0 },
          { id: 'bm-edit', title: 'Before', url: 'https://edit.example', parentId: '1', index: 1 }
        ]
      }
    ]

    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          {
            id: 'temp_1',
            title: 'New Folder',
            parentId: '1',
            index: 0,
            children: [
              {
                id: 'bm-edit',
                title: 'After',
                url: 'https://edit.example',
                parentId: 'temp_1',
                index: 0
              }
            ]
          }
        ]
      }
    ]

    const diff = bookmarkDiffService.calculateDiff(virtualRoot(original), virtualRoot(proposal), {
      flatOriginalNodes: flattenNodes(original)
    })

    const order = diff.operations.map(op => op.type)
    const deleteIdx = order.indexOf('delete')
    const moveIdx = order.indexOf('move')
    const editIdx = order.indexOf('edit')
    const createIdx = order.indexOf('create')

    expect(deleteIdx).toBeLessThan(moveIdx)
    expect(moveIdx).toBeLessThan(editIdx)
    expect(editIdx).toBeLessThan(createIdx)
  })

  it('不应为 Chrome 系统节点生成操作', () => {
    const original: BookmarkNode[] = [barRoot]
    const proposal: BookmarkNode[] = [{ ...barRoot, title: '改名书签栏' }]

    const diff = bookmarkDiffService.calculateDiff(virtualRoot(original), virtualRoot(proposal), {
      flatOriginalNodes: flattenNodes(original)
    })

    expect(diff.operations.some(op => op.nodeId === '1')).toBe(false)
  })
})

describe('bookmark-diff-service.groupOperationsByType', () => {
  it('应按类型分组操作', () => {
    const grouped = bookmarkDiffService.groupOperationsByType([
      {
        type: 'delete',
        nodeId: 'bm-1',
        title: 'A',
        isFolder: false,
        parentId: '1'
      },
      {
        type: 'move',
        nodeId: 'bm-2',
        title: 'B',
        isFolder: false,
        fromParentId: '1',
        toParentId: '2',
        fromIndex: 0,
        toIndex: 0,
        isSameParent: false
      }
    ])

    expect(grouped.delete).toHaveLength(1)
    expect(grouped.move).toHaveLength(1)
    expect(grouped.edit).toHaveLength(0)
    expect(grouped.create).toHaveLength(0)
  })
})

describe('management-proposal-diff.calculateManagementProposalDiff', () => {
  it('应组合 calculateDiff 与 postProcessManagementProposalDiff', () => {
    const original: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          { id: 'bm-1', title: 'Link', url: 'https://example.com', parentId: '1', index: 0 }
        ]
      }
    ]

    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          {
            id: 'temp_1',
            title: '新建夹',
            parentId: '1',
            index: 0,
            children: [
              {
                id: 'bm-1',
                title: 'Link',
                url: 'https://example.com',
                parentId: 'temp_1',
                index: 0
              }
            ]
          }
        ]
      }
    ]

    const result = calculateManagementProposalDiff(original, proposal, flattenNodes(original))

    expect(result).not.toBeNull()
    expect(result!.operations.map(op => `${op.type}:${op.nodeId}`)).toEqual([
      'move:bm-1',
      'create:temp_1'
    ])
  })
})
