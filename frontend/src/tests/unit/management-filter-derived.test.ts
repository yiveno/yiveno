import { describe, expect, it } from 'vitest'
import type { BookmarkNode } from '@/types'
import {
  buildFilteredManagementRightTree,
  type ManagementSearchMatchState
} from '@/application/bookmark/management-tree-search'

describe('management-filter-derived', () => {
  const proposalTree: BookmarkNode[] = [
    {
      id: '1',
      title: '书签栏',
      children: [
        {
          id: 'folder-a',
          title: '购物',
          children: [
            {
              id: 'bm-taobao',
              title: '淘宝',
              url: 'https://taobao.com'
            }
          ]
        }
      ]
    }
  ]

  const match: ManagementSearchMatchState = {
    query: '淘宝',
    traitFilterIds: [],
    leftMatchedIds: null,
    rightMatchedIds: new Set(['bm-taobao']),
    isTextFilterActive: true,
    hasTraitFilterActive: false
  }

  it('提案树变更后派生视图应同步更新', () => {
    const pruned = buildFilteredManagementRightTree(proposalTree, match)
    expect(pruned[0]?.children?.[0]?.children?.[0]?.id).toBe('bm-taobao')

    const afterMove: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: 'bm-taobao',
            title: '淘宝',
            url: 'https://taobao.com'
          }
        ]
      }
    ]

    const prunedAfterMove = buildFilteredManagementRightTree(afterMove, match)
    expect(prunedAfterMove[0]?.children?.[0]?.id).toBe('bm-taobao')
    expect(prunedAfterMove[0]?.children?.[0]?.title).toBe('淘宝')
  })

  it('删除节点后派生视图不应保留幽灵节点', () => {
    const afterDelete: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        children: []
      }
    ]

    const pruned = buildFilteredManagementRightTree(afterDelete, match)
    expect(pruned).toEqual([])
  })
})
