import { describe, expect, it } from 'vitest'
import { buildProposalTreeFromOrganizeResult } from '@/application/bookmark/bookmark-organize-proposal-builder'
import {
  auditOrganizeProposalIntegrity,
  isNodeUnderAiOrganizeSubtree,
  flattenProposalNodeMap
} from '@/application/bookmark/organize-proposal-audit'
import type { BookmarkNode } from '@/types'

describe('organize-proposal-audit', () => {
  const originalRoots: BookmarkNode[] = [
    {
      id: '1',
      title: '书签栏',
      parentId: '0',
      index: 0,
      children: [
        {
          id: 'bm-1',
          title: 'A',
          url: 'https://a.example.com',
          parentId: '1',
          index: 0
        },
        {
          id: 'bm-2',
          title: 'B',
          url: 'https://b.example.com',
          parentId: '1',
          index: 1
        }
      ]
    }
  ]

  const bookmarkItems = [
    { id: 'bm-1', title: 'A', url: 'https://a.example.com', parentId: '1', index: 0 },
    { id: 'bm-2', title: 'B', url: 'https://b.example.com', parentId: '1', index: 1 }
  ]

  it('完整提案应通过审计', () => {
    const proposal = buildProposalTreeFromOrganizeResult(
      originalRoots,
      [{ name: '工具', path: '工具', bookmarkIds: ['bm-1', 'bm-2'] }],
      bookmarkItems
    )

    const audit = auditOrganizeProposalIntegrity(bookmarkItems, proposal)
    expect(audit.ok).toBe(true)
    expect(audit.missingIds).toEqual([])
    expect(audit.notInAiSubtreeIds).toEqual([])
    expect(audit.totalInAiSubtree).toBe(2)
  })

  it('LLM 漏分书签时由修复逻辑兜底并通过审计', () => {
    const proposal = buildProposalTreeFromOrganizeResult(
      originalRoots,
      [{ name: '工具', path: '工具', bookmarkIds: ['bm-1'] }],
      bookmarkItems
    )

    const audit = auditOrganizeProposalIntegrity(bookmarkItems, proposal)
    expect(audit.ok).toBe(true)
    expect(audit.missingIds).toEqual([])
    expect(audit.notInAiSubtreeIds).toEqual([])
  })

  it('书签仍在书签栏旧位置、未归入 AI 目录时应失败', () => {
    const proposal: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
        children: [
          {
            id: 'temp_ai_1',
            title: '工具',
            parentId: '1',
            children: [
              {
                id: 'bm-1',
                title: 'A',
                url: 'https://a.example.com',
                parentId: 'temp_ai_1',
                index: 0
              }
            ]
          },
          {
            id: 'bm-2',
            title: 'B',
            url: 'https://b.example.com',
            parentId: '1',
            index: 1
          }
        ]
      }
    ]

    const audit = auditOrganizeProposalIntegrity(bookmarkItems, proposal)
    expect(audit.ok).toBe(false)
    expect(audit.notInAiSubtreeIds).toEqual(['bm-2'])
  })

  it('无 URL 书签按 ID 参与整理并通过审计', () => {
    const rootsWithNoUrl: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        parentId: '0',
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
            title: 'A',
            url: 'https://a.example.com',
            parentId: '1',
            index: 1
          }
        ]
      }
    ]

    const items = [
      { id: 'no-url-bm', title: '无链接笔记', url: '', parentId: '1', index: 0 },
      { id: 'bm-1', title: 'A', url: 'https://a.example.com', parentId: '1', index: 1 }
    ]

    const proposal = buildProposalTreeFromOrganizeResult(
      rootsWithNoUrl,
      [{ name: '工具', path: '工具', bookmarkIds: ['no-url-bm', 'bm-1'] }],
      items
    )

    const audit = auditOrganizeProposalIntegrity(items, proposal)
    expect(audit.ok).toBe(true)
    expect(audit.totalInAiSubtree).toBe(2)
  })

  it('isNodeUnderAiOrganizeSubtree 识别 temp_ai 子树', () => {
    const proposal = buildProposalTreeFromOrganizeResult(
      originalRoots,
      [{ name: '工具', path: '工具', bookmarkIds: ['bm-1'] }],
      [bookmarkItems[0]!]
    )
    const map = flattenProposalNodeMap(proposal)

    expect(isNodeUnderAiOrganizeSubtree('bm-1', map)).toBe(true)
    expect(isNodeUnderAiOrganizeSubtree('bm-2', map)).toBe(false)
  })
})
