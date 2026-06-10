import { describe, expect, it } from 'vitest'
import type { BookmarkNode } from '@/types'
import {
  createFolderInProposalTree,
  deleteNodeInProposalTree,
  editNodeInProposalTree,
  moveNodeInProposalTree
} from '@/application/bookmark/proposal-tree-edit-service'

function cloneRoots(roots: BookmarkNode[]): BookmarkNode[] {
  return structuredClone(roots)
}

describe('proposal-tree-edit-service', () => {
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
              id: 'bm-1',
              title: 'One',
              url: 'https://one.example',
              parentId: 'folder-a',
              index: 0
            },
            {
              id: 'bm-2',
              title: 'Two',
              url: 'https://two.example',
              parentId: 'folder-a',
              index: 1
            }
          ]
        },
        {
          id: 'bm-3',
          title: 'Three',
          url: 'https://three.example',
          parentId: '1',
          index: 1
        }
      ]
    }
  ]

  it('moveNodeInProposalTree 应将节点移动到目标之后', () => {
    const roots = cloneRoots(sampleRoots)
    const result = moveNodeInProposalTree(roots, {
      sourceId: 'bm-1',
      targetId: 'bm-3',
      position: 'after'
    })

    expect(result).toEqual({
      nodeId: 'bm-1',
      newParentId: '1',
      newIndex: 2
    })

    const barChildren = roots[0]?.children ?? []
    expect(barChildren.map(node => node.id)).toEqual(['folder-a', 'bm-3', 'bm-1'])
    expect(roots[0]?.children?.[0]?.children?.map(node => node.id)).toEqual(['bm-2'])
  })

  it('moveNodeInProposalTree 应将节点放入文件夹内部', () => {
    const roots = cloneRoots(sampleRoots)
    const result = moveNodeInProposalTree(roots, {
      sourceId: 'bm-3',
      targetId: 'folder-a',
      position: 'inside-last'
    })

    expect(result.newParentId).toBe('folder-a')
    expect(result.newIndex).toBe(2)
    expect(roots[0]?.children?.[0]?.children?.map(node => node.id)).toEqual([
      'bm-1',
      'bm-2',
      'bm-3'
    ])
  })

  it('deleteNodeInProposalTree 应删除目标节点', () => {
    const roots = cloneRoots(sampleRoots)
    const deleted = deleteNodeInProposalTree(roots, 'bm-2')

    expect(deleted).toBe(true)
    expect(roots[0]?.children?.[0]?.children?.map(node => node.id)).toEqual(['bm-1'])
    expect(deleteNodeInProposalTree(roots, 'missing')).toBe(false)
  })

  it('editNodeInProposalTree 应更新标题与 URL', () => {
    const roots = cloneRoots(sampleRoots)
    const edited = editNodeInProposalTree(roots, {
      id: 'bm-1',
      title: 'Updated',
      url: 'https://updated.example'
    })

    expect(edited).toBe(true)
    expect(roots[0]?.children?.[0]?.children?.[0]).toMatchObject({
      id: 'bm-1',
      title: 'Updated',
      url: 'https://updated.example'
    })
    expect(editNodeInProposalTree(roots, { id: 'missing', title: 'X' })).toBe(false)
  })

  it('moveNodeInProposalTree 应拒绝文件夹拖到子孙节点 before', () => {
    const roots = cloneRoots(sampleRoots)

    expect(() =>
      moveNodeInProposalTree(roots, {
        sourceId: 'folder-a',
        targetId: 'bm-1',
        position: 'before'
      })
    ).toThrow('PROPOSAL_DROP_INVALID')
  })

  it('createFolderInProposalTree 应在父节点下创建临时文件夹', () => {
    const roots = cloneRoots(sampleRoots)
    const created = createFolderInProposalTree(roots, 'folder-a', '新建子夹')

    expect(created).not.toBeNull()
    expect(created?.id).toMatch(/^temp_\d+$/)
    expect(created?.title).toBe('新建子夹')
    expect(roots[0]?.children?.[0]?.children?.at(-1)?.id).toBe(created?.id)
    expect(createFolderInProposalTree(roots, 'missing', 'X')).toBeNull()
    expect(createFolderInProposalTree(roots, 'folder-a', '   ')).toBeNull()
  })
})
