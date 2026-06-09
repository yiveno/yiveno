/**
 * 提案树规范化（AI 一键整理 / 手动右侧编辑通用）
 */

import { BOOKMARKS_BAR_ID, isChromeSystemBookmarkId } from '@/core/bookmark/chrome-system-ids'
import { isOrganizeBookmarkLeaf } from '@/core/bookmark/organize-bookmark-leaf'
import {
  isNodeUnderTempFolderSubtree,
  type TempFolderParentView
} from '@/core/bookmark/temp-folder-ids'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'

const loggerPrefix = 'ProposalTreeNormalize'
const OTHER_BOOKMARKS_ID = '2'

interface FlatProposalEntry {
  node: BookmarkNode
  parentId: string | undefined
}

/**
 * 将提案树展平为 id → 条目（children 清空以便重建）
 */
function flattenProposalToMap(
  roots: BookmarkNode[],
  defaultParentId = '0'
): Map<string, FlatProposalEntry> {
  const map = new Map<string, FlatProposalEntry>()

  const walk = (nodes: BookmarkNode[], parentId: string) => {
    nodes.forEach((node, index) => {
      const entry: FlatProposalEntry = {
        node: { ...node, parentId, index, children: undefined },
        parentId
      }
      map.set(String(node.id), entry)
      if (node.children?.length) {
        walk(node.children, String(node.id))
      }
    })
  }

  walk(roots, defaultParentId)
  return map
}

/**
 * 从 flat 映射重建树
 */
function rebuildProposalTreeFromMap(map: Map<string, FlatProposalEntry>): BookmarkNode[] {
  const nodeMap = new Map<string, BookmarkNode>()
  const childIds = new Set<string>()

  for (const [id, entry] of map) {
    nodeMap.set(id, {
      ...entry.node,
      children: isOrganizeBookmarkLeaf(entry.node) ? undefined : []
    })
  }

  for (const [id, entry] of map) {
    const parentId = entry.parentId
    if (!parentId || !nodeMap.has(parentId)) {
      continue
    }
    const parent = nodeMap.get(parentId)!
    if (!parent.children) {
      parent.children = []
    }
    if (!parent.children.some(child => String(child.id) === id)) {
      parent.children.push(nodeMap.get(id)!)
      childIds.add(id)
    }
  }

  for (const node of nodeMap.values()) {
    if (node.children?.length) {
      node.children.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    }
  }

  const roots: BookmarkNode[] = []
  for (const [id] of map) {
    if (!childIds.has(id) && id !== '0') {
      roots.push(nodeMap.get(id)!)
    }
  }

  roots.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  return roots
}

function collectChildIds(parentId: string, map: Map<string, FlatProposalEntry>): string[] {
  const children: string[] = []
  for (const [id, entry] of map) {
    if (entry.parentId === parentId) {
      children.push(id)
    }
  }
  return children
}

function isDescendantOf(
  nodeId: string,
  ancestorId: string,
  map: Map<string, FlatProposalEntry>
): boolean {
  let current = map.get(nodeId)?.parentId
  const guard = new Set<string>()

  while (current && current !== '0' && !guard.has(current)) {
    guard.add(current)
    if (current === ancestorId) {
      return true
    }
    current = map.get(current)?.parentId
  }

  return false
}

function hasBookmarkLeafDescendant(folderId: string, map: Map<string, FlatProposalEntry>): boolean {
  for (const childId of collectChildIds(folderId, map)) {
    const entry = map.get(childId)
    if (!entry) {
      continue
    }
    if (isOrganizeBookmarkLeaf(entry.node)) {
      return true
    }
    if (hasBookmarkLeafDescendant(childId, map)) {
      return true
    }
  }
  return false
}

function toTempParentViewMap(
  map: Map<string, FlatProposalEntry>
): Map<string, TempFolderParentView> {
  const view = new Map<string, TempFolderParentView>()
  for (const [id, entry] of map) {
    view.set(id, { parentId: entry.parentId })
  }
  return view
}

/**
 * 节点是否位于提案新建目录子树（temp_ai_* 与 temp_* 均计入）
 */
export function isNodeUnderProposalNewFolderSubtree(
  nodeId: string,
  map: Map<string, TempFolderParentView>
): boolean {
  return isNodeUnderTempFolderSubtree(nodeId, map, { aiOnly: false })
}

/**
 * 原始树中文件夹 → 其下直接子书签 ID
 */
export function buildOriginalFolderBookmarkChildren(
  originalRoots: BookmarkNode[]
): Map<string, Set<string>> {
  const map = flattenProposalToMap(originalRoots)
  const childrenByFolder = new Map<string, Set<string>>()

  for (const [id, entry] of map) {
    if (!isOrganizeBookmarkLeaf(entry.node)) {
      continue
    }
    const parentId = entry.parentId
    if (!parentId) {
      continue
    }
    const siblings = childrenByFolder.get(parentId) ?? new Set<string>()
    siblings.add(id)
    childrenByFolder.set(parentId, siblings)
  }

  return childrenByFolder
}

/**
 * 移除书签栏下对照原始树已搬空的旧文件夹（保护 temp_* 新目录子树与仍有书签的目录）
 */
export function pruneEmptiedLegacyBookmarksBarFolders(
  proposalRoots: BookmarkNode[],
  originalRoots: BookmarkNode[]
): BookmarkNode[] {
  const proposalMap = flattenProposalToMap(proposalRoots)
  const originalFolderChildren = buildOriginalFolderBookmarkChildren(originalRoots)
  const tempView = toTempParentViewMap(proposalMap)
  const toRemove: string[] = []

  for (const [id, entry] of proposalMap) {
    if (isChromeSystemBookmarkId(id)) {
      continue
    }
    if (isOrganizeBookmarkLeaf(entry.node)) {
      continue
    }
    if (isDescendantOf(id, OTHER_BOOKMARKS_ID, proposalMap)) {
      continue
    }
    if (!isDescendantOf(id, BOOKMARKS_BAR_ID, proposalMap)) {
      continue
    }
    if (isNodeUnderProposalNewFolderSubtree(id, tempView)) {
      continue
    }
    if (hasBookmarkLeafDescendant(id, proposalMap)) {
      continue
    }

    const formerChildren = originalFolderChildren.get(id)
    if (!formerChildren || formerChildren.size === 0) {
      continue
    }

    toRemove.push(id)
  }

  if (toRemove.length === 0) {
    return proposalRoots
  }

  for (const id of toRemove) {
    proposalMap.delete(id)
  }

  logger.info(loggerPrefix, '已移除书签栏已搬空的旧目录', { removedCount: toRemove.length })
  return rebuildProposalTreeFromMap(proposalMap)
}
