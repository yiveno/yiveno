import { describe, expect, it } from 'vitest'
import type { BookmarkNode } from '@/types'
import {
  buildProposalParentMap,
  isDescendantInProposalTree,
  isDropOnChromeRootAtProposalRoot,
  isProposalDropAllowed,
  isProposalNodeDraggable,
  shouldInsertAtTopOfChromeRootFolder,
  shouldInsertAtTopOfFolder,
  shouldRedirectDropIntoChromeRootFolder,
  syncProposalTreeMetadata,
  validateProposalMove
} from '@/application/bookmark/proposal-tree-move'

describe('proposal-tree-move', () => {
  const sampleRoots: BookmarkNode[] = [
    {
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
              id: 'bm-child',
              title: 'Child',
              url: 'https://example.com',
              parentId: 'folder-a',
              index: 0
            }
          ]
        }
      ]
    }
  ]

  it('应识别提案树根层上的 Chrome 系统目录', () => {
    expect(isDropOnChromeRootAtProposalRoot(undefined, '1')).toBe(true)
    expect(isDropOnChromeRootAtProposalRoot(undefined, '2')).toBe(true)
    expect(isDropOnChromeRootAtProposalRoot('1', '42')).toBe(false)
    expect(isDropOnChromeRootAtProposalRoot(undefined, '42')).toBe(false)
  })

  it('before/inside 应插入系统目录顶部，inside-last/after 为底部', () => {
    expect(shouldInsertAtTopOfChromeRootFolder('before')).toBe(true)
    expect(shouldInsertAtTopOfChromeRootFolder('inside')).toBe(true)
    expect(shouldInsertAtTopOfChromeRootFolder('inside-last')).toBe(false)
    expect(shouldInsertAtTopOfChromeRootFolder('after')).toBe(false)
  })

  it('普通文件夹 inside 为顶部，inside-last 为底部', () => {
    expect(shouldInsertAtTopOfFolder('inside')).toBe(true)
    expect(shouldInsertAtTopOfFolder('inside-last')).toBe(false)
  })

  it('Chrome 系统节点不可拖拽', () => {
    expect(isProposalNodeDraggable('1')).toBe(false)
    expect(isProposalNodeDraggable('bm-child')).toBe(true)
  })

  it('应沿 parentId 链检测后代关系', () => {
    const parentMap = buildProposalParentMap(sampleRoots)
    const resolveParentId = (id: string) => parentMap.get(id)

    expect(isDescendantInProposalTree('bm-child', 'folder-a', resolveParentId)).toBe(true)
    expect(isDescendantInProposalTree('bm-child', '1', resolveParentId)).toBe(true)
    expect(isDescendantInProposalTree('folder-a', 'bm-child', resolveParentId)).toBe(false)
  })

  it('文件夹不能把落点放在自身子树内（含 before/after）', () => {
    const parentMap = buildProposalParentMap(sampleRoots)
    const resolveParentId = (id: string) => parentMap.get(id)

    for (const position of ['inside', 'inside-last', 'before', 'after'] as const) {
      expect(
        isProposalDropAllowed({
          sourceId: 'folder-a',
          targetId: 'bm-child',
          sourceIsFolder: true,
          position,
          resolveParentId
        })
      ).toBe(false)
    }
  })

  it('validateProposalMove 应在目标不存在时抛错', () => {
    expect(() =>
      validateProposalMove(sampleRoots, {
        sourceId: 'bm-child',
        targetId: 'missing',
        position: 'before'
      })
    ).toThrow('PROPOSAL_DROP_TARGET_NOT_FOUND')
  })

  it('普通书签落在系统根目录时应重定向到目录内部', () => {
    expect(shouldRedirectDropIntoChromeRootFolder(undefined, '1', 'bm-1', 'after')).toBe(true)
    expect(shouldRedirectDropIntoChromeRootFolder(undefined, '1', 'bm-1', 'inside-last')).toBe(true)
    expect(shouldRedirectDropIntoChromeRootFolder('1', 'bm-2', 'bm-1', 'after')).toBe(false)
    expect(shouldRedirectDropIntoChromeRootFolder(undefined, '1', '1', 'after')).toBe(false)
  })

  it('syncProposalTreeMetadata 应刷新层级字段', () => {
    const roots: BookmarkNode[] = [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: 'bm-1',
            title: 'Example',
            url: 'https://example.com'
          }
        ]
      }
    ]

    syncProposalTreeMetadata(roots)

    expect(roots[0]?.parentId).toBe('0')
    expect(roots[0]?.ancestorIds).toEqual([])
    expect(roots[0]?.children?.[0]?.parentId).toBe('1')
    expect(roots[0]?.children?.[0]?.ancestorIds).toEqual(['1'])
    expect(roots[0]?.children?.[0]?.pathIds).toEqual(['1', 'bm-1'])
    expect(roots[0]?.children?.[0]?.depth).toBe(1)
  })
})
