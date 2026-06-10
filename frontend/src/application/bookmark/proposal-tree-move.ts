/**
 * 整理页提案树拖拽落点解析与树元数据维护
 */

import {
  CHROME_ROOT_ID,
  isChromeSystemBookmarkId,
  isChromeVisibleRootId
} from '@/core/bookmark/chrome-system-ids'
import type { BookmarkNode } from '@/types'

/** 提案树拖拽落点 */
export type ProposalDropPosition = 'before' | 'inside' | 'inside-last' | 'after'

/** 找不到放置目标时抛出 */
export const PROPOSAL_DROP_TARGET_NOT_FOUND = 'PROPOSAL_DROP_TARGET_NOT_FOUND'

/** 非法拖拽落点（环、系统节点等） */
export const PROPOSAL_DROP_INVALID = 'PROPOSAL_DROP_INVALID'

/**
 * 从提案树根构建 id → parentId 映射（用于环检测）
 */
export function buildProposalParentMap(roots: BookmarkNode[]): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>()

  const walk = (nodes: BookmarkNode[], parentId: string | undefined): void => {
    for (const node of nodes) {
      const id = String(node.id)
      map.set(id, parentId)
      if (node.children?.length) {
        walk(node.children, id)
      }
    }
  }

  walk(roots, undefined)
  return map
}

/**
 * 沿 parentId 上溯，判断 nodeId 是否为 ancestorId 的后代
 */
export function isDescendantInProposalTree(
  nodeId: string,
  ancestorId: string,
  resolveParentId: (id: string) => string | undefined
): boolean {
  let current: string | undefined = nodeId
  const visited = new Set<string>()

  while (current) {
    if (current === ancestorId) {
      return true
    }
    if (visited.has(current)) {
      return false
    }
    visited.add(current)
    current = resolveParentId(current)
  }

  return false
}

/**
 * Chrome 系统节点不可作为拖拽源
 */
export function isProposalNodeDraggable(nodeId: string): boolean {
  return !isChromeSystemBookmarkId(nodeId)
}

/**
 * 是否允许将 source 放到 target 的指定位置
 */
export function isProposalDropAllowed(options: {
  sourceId: string
  targetId: string
  sourceIsFolder: boolean
  position: ProposalDropPosition
  resolveParentId: (id: string) => string | undefined
}): boolean {
  const { sourceId, targetId, sourceIsFolder, resolveParentId } = options

  if (sourceId === targetId) {
    return false
  }
  if (!isProposalNodeDraggable(sourceId)) {
    return false
  }

  // 文件夹不能把落点放在自身子树内（含 before/after，否则先删整棵子树会导致目标消失）
  if (sourceIsFolder && isDescendantInProposalTree(targetId, sourceId, resolveParentId)) {
    return false
  }

  return true
}

/**
 * 提案树中是否存在指定节点
 */
export function hasProposalTreeNode(roots: BookmarkNode[], nodeId: string): boolean {
  const walk = (nodes: BookmarkNode[]): boolean => {
    for (const node of nodes) {
      if (String(node.id) === nodeId) {
        return true
      }
      if (node.children?.length && walk(node.children)) {
        return true
      }
    }
    return false
  }

  return walk(roots)
}

/**
 * 查找提案树节点（用于判断源是否为文件夹）
 */
export function findProposalTreeNode(roots: BookmarkNode[], nodeId: string): BookmarkNode | null {
  for (const node of roots) {
    if (String(node.id) === nodeId) {
      return node
    }
    if (node.children?.length) {
      const found = findProposalTreeNode(node.children, nodeId)
      if (found) {
        return found
      }
    }
  }
  return null
}

/** 提案树拖拽移动入参（校验与执行共用） */
export interface ProposalMoveInput {
  sourceId: string
  targetId: string
  position: ProposalDropPosition
}

/**
 * 校验提案树拖拽是否可在当前树上执行（与 canDrop / moveBookmark 共用）
 */
export function validateProposalMove(roots: BookmarkNode[], data: ProposalMoveInput): void {
  const sourceNode = findProposalTreeNode(roots, data.sourceId)
  if (!sourceNode) {
    throw new Error('未找到源节点')
  }

  if (!hasProposalTreeNode(roots, data.targetId)) {
    throw new Error(PROPOSAL_DROP_TARGET_NOT_FOUND)
  }

  const parentMap = buildProposalParentMap(roots)
  const resolveParentId = (id: string) => parentMap.get(id)

  if (
    !isProposalDropAllowed({
      sourceId: data.sourceId,
      targetId: data.targetId,
      sourceIsFolder: !sourceNode.url,
      position: data.position,
      resolveParentId
    })
  ) {
    throw new Error(PROPOSAL_DROP_INVALID)
  }
}

/**
 * 是否为提案树根层上的 Chrome 系统目录（书签栏 / 其他书签等）
 */
export function isDropOnChromeRootAtProposalRoot(
  parentContextId: string | undefined,
  targetId: string
): boolean {
  return parentContextId === undefined && isChromeVisibleRootId(targetId)
}

/**
 * 落在系统根目录时，是否应插入到该目录顶部（否则为目录底部）
 */
export function shouldInsertAtTopOfChromeRootFolder(position: ProposalDropPosition): boolean {
  return position === 'before' || position === 'inside'
}

/**
 * 是否应将落点重定向到系统根目录内部（避免书签成为根层兄弟节点）
 */
export function shouldRedirectDropIntoChromeRootFolder(
  parentContextId: string | undefined,
  targetId: string,
  sourceId: string,
  position: ProposalDropPosition
): boolean {
  if (!isDropOnChromeRootAtProposalRoot(parentContextId, targetId)) {
    return false
  }
  if (isChromeSystemBookmarkId(sourceId)) {
    return false
  }
  return (
    position === 'before' ||
    position === 'inside' ||
    position === 'inside-last' ||
    position === 'after'
  )
}

/**
 * 是否应插入到目标文件夹内部顶部
 */
export function shouldInsertAtTopOfFolder(position: ProposalDropPosition): boolean {
  return position === 'inside'
}

/**
 * 移动后同步提案树 parentId / index / depth / ancestorIds / pathIds
 */
export function syncProposalTreeMetadata(roots: BookmarkNode[]): void {
  const walk = (
    nodes: BookmarkNode[],
    parentId: string,
    ancestors: string[],
    depth: number
  ): void => {
    nodes.forEach((node, index) => {
      const id = String(node.id)
      node.parentId = parentId
      node.index = index
      node.depth = depth
      node.ancestorIds = [...ancestors]
      node.pathIds = [...ancestors, id]

      if (node.children?.length) {
        walk(node.children, id, [...ancestors, id], depth + 1)
      }
    })
  }

  walk(roots, CHROME_ROOT_ID, [], 0)
}
