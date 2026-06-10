import type { BookmarkNode } from '@/types'

/**
 * 深拷贝并标记提案树节点为已加载（避免懒加载占位影响 diff/拖拽）
 */
export function prepareProposalNode(node: BookmarkNode): BookmarkNode {
  const cloned: BookmarkNode = {
    ...node,
    id: String(node.id),
    parentId: node.parentId ? String(node.parentId) : undefined
  }

  if (Array.isArray(node.children) && node.children.length > 0) {
    cloned.children = node.children.map(child => prepareProposalNode(child))
    cloned.childrenCount = cloned.children.length
    cloned._childrenLoaded = true
  } else {
    cloned.children = []
    cloned.childrenCount = node.childrenCount ?? 0
    cloned._childrenLoaded = true
  }

  return cloned
}

/**
 * 批量准备提案树根节点列表
 */
export function prepareProposalTreeNodes(nodes: BookmarkNode[]): BookmarkNode[] {
  return nodes.map(node => prepareProposalNode(node))
}
