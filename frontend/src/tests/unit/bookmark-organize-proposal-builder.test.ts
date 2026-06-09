import { describe, expect, it } from 'vitest'
import { buildProposalTreeFromOrganizeResult } from '@/application/bookmark/bookmark-organize-proposal-builder'
import { bookmarkDiffService } from '@/application/bookmark/bookmark-diff-service'
import type { BookmarkNode } from '@/types'

function findNodeById(nodes: BookmarkNode[], id: string): BookmarkNode | undefined {
  for (const node of nodes) {
    if (String(node.id) === id) {
      return node
    }
    if (node.children?.length) {
      const found = findNodeById(node.children, id)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

describe('bookmark-organize-proposal-builder', () => {
  const originalRoots: BookmarkNode[] = [
    {
      id: '1',
      title: '书签栏',
      parentId: '0',
      index: 0,
      children: [
        {
          id: 'old-folder',
          title: '旧音乐',
          parentId: '1',
          index: 0,
          children: [
            {
              id: 'bm-1',
              title: 'ChatGPT',
              url: 'https://chatgpt.com',
              parentId: 'old-folder',
              index: 0
            }
          ]
        }
      ]
    },
    {
      id: '2',
      title: '其他书签',
      parentId: '0',
      index: 1,
      children: [
        {
          id: 'other-bm',
          title: '保留项',
          url: 'https://example.com',
          parentId: '2',
          index: 0
        }
      ]
    }
  ]

  it('覆盖书签栏旧目录，仅保留 AI 分类结果', () => {
    const proposal = buildProposalTreeFromOrganizeResult(
      originalRoots,
      [
        {
          name: '常用工具',
          path: '常用工具',
          bookmarkIds: ['bm-1']
        }
      ],
      [
        {
          id: 'bm-1',
          title: 'ChatGPT',
          url: 'https://chatgpt.com',
          parentId: 'old-folder',
          index: 0
        }
      ]
    )

    const bar = findNodeById(proposal, '1')
    expect(bar?.children?.map(child => child.title)).toEqual(['常用工具'])
    expect(findNodeById(proposal, 'old-folder')).toBeUndefined()

    const aiFolder = bar?.children?.[0]
    expect(aiFolder?.children?.[0]?.id).toBe('bm-1')

    const otherBookmarks = findNodeById(proposal, '2')
    expect(otherBookmarks?.children?.[0]?.id).toBe('other-bm')
  })

  it('同 URL 不同 ID 的书签按 ID 各自保留', () => {
    const rootsWithDupes: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        index: 0,
        children: [
          {
            id: 'dup-1',
            title: '123123 - Google 搜索',
            url: 'https://www.google.com/search?q=123123',
            parentId: '1',
            index: 0
          },
          {
            id: 'dup-2',
            title: '123123 - Google 搜索',
            url: 'https://www.google.com/search?q=123123',
            parentId: '1',
            index: 1
          },
          {
            id: 'dup-3',
            title: '123123 - Google 搜索',
            url: 'https://www.google.com/search?q=123123',
            parentId: '1',
            index: 2
          }
        ]
      }
    ]

    const duplicateSnapshots = [
      {
        id: 'dup-1',
        title: '123123 - Google 搜索',
        url: 'https://www.google.com/search?q=123123',
        parentId: '1',
        index: 0
      },
      {
        id: 'dup-2',
        title: '123123 - Google 搜索',
        url: 'https://www.google.com/search?q=123123',
        parentId: '1',
        index: 1
      },
      {
        id: 'dup-3',
        title: '123123 - Google 搜索',
        url: 'https://www.google.com/search?q=123123',
        parentId: '1',
        index: 2
      }
    ]

    const proposal = buildProposalTreeFromOrganizeResult(
      rootsWithDupes,
      [
        {
          name: '搜索引擎',
          path: '搜索引擎',
          bookmarkIds: ['dup-1', 'dup-2', 'dup-3']
        }
      ],
      duplicateSnapshots
    )

    const searchFolder = findNodeById(proposal, '1')?.children?.[0]
    expect(searchFolder?.title).toBe('搜索引擎')
    expect(searchFolder?.children).toHaveLength(3)
    expect(searchFolder?.children?.map(child => child.id).sort()).toEqual([
      'dup-1',
      'dup-2',
      'dup-3'
    ])
  })

  it('diff 应产生移动与删除，而非重复新增书签', () => {
    const proposal = buildProposalTreeFromOrganizeResult(
      originalRoots,
      [{ name: '常用工具', path: '常用工具', bookmarkIds: ['bm-1'] }],
      [
        {
          id: 'bm-1',
          title: 'ChatGPT',
          url: 'https://chatgpt.com',
          parentId: 'old-folder',
          index: 0
        }
      ]
    )

    const originalMap = new Map<string, BookmarkNode>()
    const walk = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        originalMap.set(String(node.id), node)
        if (node.children?.length) {
          walk(node.children)
        }
      }
    }
    walk(originalRoots)

    const diff = bookmarkDiffService.calculateDiff(
      { id: 'virtual-root', title: 'Root', children: originalRoots },
      { id: 'virtual-root', title: 'Root', children: proposal },
      { flatOriginalNodes: originalMap }
    )

    const creates = diff.operations.filter(op => op.type === 'create')
    const moves = diff.operations.filter(op => op.type === 'move')
    const deletes = diff.operations.filter(op => op.type === 'delete')

    expect(creates.filter(op => !op.isFolder)).toHaveLength(0)
    expect(moves.some(op => op.nodeId === 'bm-1')).toBe(true)
    expect(deletes.some(op => op.nodeId === 'old-folder')).toBe(true)
  })

  it('未参与整理的书签及其旧目录应保留在提案树中', () => {
    const originalWithLegacyChildren: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        index: 0,
        children: [
          {
            id: 'legacy-folder',
            title: '旧目录',
            parentId: '1',
            index: 0,
            children: [
              {
                id: 'legacy-child',
                title: '旧书签',
                url: 'https://legacy.example.com',
                parentId: 'legacy-folder',
                index: 0
              }
            ]
          },
          {
            id: 'kept-bookmark',
            title: '保留书签',
            url: 'https://kept.example.com',
            parentId: '1',
            index: 1
          }
        ]
      }
    ]

    const proposal = buildProposalTreeFromOrganizeResult(
      originalWithLegacyChildren,
      [{ name: '整理后', path: '整理后', bookmarkIds: ['kept-bookmark'] }],
      [
        {
          id: 'kept-bookmark',
          title: '保留书签',
          url: 'https://kept.example.com',
          parentId: '1',
          index: 1
        }
      ]
    )

    expect(findNodeById(proposal, 'legacy-folder')).toBeDefined()
    expect(findNodeById(proposal, 'legacy-child')).toBeDefined()

    const bar = findNodeById(proposal, '1')
    const organizedFolder = bar?.children?.find(child => child.title === '整理后')
    expect(organizedFolder?.children?.[0]?.id).toBe('kept-bookmark')

    const originalMap = new Map<string, BookmarkNode>()
    const walk = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        originalMap.set(String(node.id), node)
        if (node.children?.length) {
          walk(node.children)
        }
      }
    }
    walk(originalWithLegacyChildren)

    const diff = bookmarkDiffService.calculateDiff(
      { id: 'virtual-root', title: 'Root', children: originalWithLegacyChildren },
      { id: 'virtual-root', title: 'Root', children: proposal },
      { flatOriginalNodes: originalMap }
    )

    const deletes = diff.operations.filter(op => op.type === 'delete')
    expect(deletes.some(op => op.nodeId === 'legacy-folder')).toBe(false)
    expect(deletes.some(op => op.nodeId === 'legacy-child')).toBe(false)
  })

  it('无 URL 且未参与整理的书签应保留，不被 prune 删除', () => {
    const rootsWithNoUrl: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        index: 0,
        children: [
          {
            id: 'no-url-bm',
            title: '无链接笔记',
            url: '',
            parentId: '1',
            index: 0
          },
          {
            id: 'bm-1',
            title: 'ChatGPT',
            url: 'https://chatgpt.com',
            parentId: '1',
            index: 1
          }
        ]
      }
    ]

    const proposal = buildProposalTreeFromOrganizeResult(
      rootsWithNoUrl,
      [{ name: '常用工具', path: '常用工具', bookmarkIds: ['bm-1'] }],
      [
        {
          id: 'no-url-bm',
          title: '无链接笔记',
          url: '',
          parentId: '1',
          index: 0
        },
        {
          id: 'bm-1',
          title: 'ChatGPT',
          url: 'https://chatgpt.com',
          parentId: '1',
          index: 1
        }
      ]
    )

    expect(findNodeById(proposal, 'no-url-bm')).toBeDefined()

    const noUrlOrganized = buildProposalTreeFromOrganizeResult(
      rootsWithNoUrl,
      [{ name: '常用工具', path: '常用工具', bookmarkIds: ['no-url-bm', 'bm-1'] }],
      [
        { id: 'no-url-bm', title: '无链接笔记', url: '', parentId: '1', index: 0 },
        { id: 'bm-1', title: 'ChatGPT', url: 'https://chatgpt.com', parentId: '1', index: 1 }
      ]
    )
    const organizedFolder = findNodeById(noUrlOrganized, '1')?.children?.find(
      c => c.title === '常用工具'
    )
    expect(organizedFolder?.children?.map(c => c.id).sort()).toEqual(['bm-1', 'no-url-bm'])
  })
})
