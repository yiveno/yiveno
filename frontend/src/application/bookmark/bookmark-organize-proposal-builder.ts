/**
 * 将 AI 整理结果转换为管理页提案树（内存预览，不直接写 Chrome API）
 */

import { ORGANIZE_FALLBACK_FOLDER_PATH } from '@/application/ai/organize-response-parser'
import { pruneEmptiedLegacyBookmarksBarFolders } from '@/application/bookmark/proposal-tree-normalize'
import { isOrganizeBookmarkLeaf } from '@/core/bookmark/organize-bookmark-leaf'
import {
  allocateTempFolderId,
  isNodeUnderTempFolderSubtree,
  isTempFolderId,
  type TempFolderParentView
} from '@/core/bookmark/temp-folder-ids'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'
import type { FolderStructure, OrganizeBookmarkSnapshot } from './bookmark-organize-service'

const BOOKMARKS_BAR_ID = '1'
const loggerPrefix = 'BookmarkOrganizeProposalBuilder'

interface FlatBookmarkNode {
  node: BookmarkNode
  parentId: string | undefined
}

/**
 * 规范化文件夹路径（支持 `/` 与 `>` 分隔）
 */
export function normalizeOrganizePath(path: string): string[] {
  return path
    .split(/\s*(?:>|\/)\s*/)
    .map(part => part.trim())
    .filter(Boolean)
}

/**
 * 深拷贝书签节点（保留 url / trait 等字段）
 */
function cloneNode(node: BookmarkNode): BookmarkNode {
  const cloned: BookmarkNode = { ...node }
  if (node.children?.length) {
    cloned.children = node.children.map(child => cloneNode(child))
  }
  return cloned
}

/**
 * 将树展平为 id → 节点 映射，并清空 children 以便重建
 */
function flattenToMap(roots: BookmarkNode[]): Map<string, FlatBookmarkNode> {
  const map = new Map<string, FlatBookmarkNode>()

  const walk = (nodes: BookmarkNode[], parentId: string) => {
    nodes.forEach((node, index) => {
      const entry: FlatBookmarkNode = {
        node: { ...node, parentId, index, children: undefined },
        parentId
      }
      map.set(String(node.id), entry)
      if (node.children?.length) {
        walk(node.children, String(node.id))
      }
    })
  }

  // 与 IndexedDB 一致：书签栏/其他书签的 parentId 为 '0'
  walk(roots, '0')
  return map
}

/**
 * 将 IndexedDB 快照补入 flat 映射，避免树未完全展开时找不到书签
 */
function seedMissingBookmarksIntoMap(
  map: Map<string, FlatBookmarkNode>,
  bookmarkItems: OrganizeBookmarkSnapshot[]
): void {
  for (const item of bookmarkItems) {
    const id = String(item.id)
    if (map.has(id)) {
      continue
    }

    const parentId = item.parentId ? String(item.parentId) : undefined
    map.set(id, {
      node: {
        id,
        title: item.title,
        url: item.url,
        parentId,
        index: item.index
      },
      parentId
    })
  }
}

/**
 * 从 flat 映射重建树
 */
function rebuildTreeFromMap(map: Map<string, FlatBookmarkNode>): BookmarkNode[] {
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

  // 同级 index 排序
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

/**
 * 根据 AI 文件夹结构更新 flat 映射中的 parentId（分类文件夹直接挂在书签栏下）
 */
function applyFolderAssignments(
  map: Map<string, FlatBookmarkNode>,
  folders: FolderStructure[],
  organizeRootParentId: string
): void {
  const pathToFolderId = new Map<string, string>()

  const sorted = [...folders].sort(
    (a, b) => normalizeOrganizePath(a.path).length - normalizeOrganizePath(b.path).length
  )

  for (const entry of sorted) {
    const parts = normalizeOrganizePath(entry.path)
    if (parts.length === 0) {
      continue
    }

    let parentId = organizeRootParentId

    for (let depth = 0; depth < parts.length; depth++) {
      const segment = parts[depth]
      if (!segment) {
        continue
      }
      const subPath = parts.slice(0, depth + 1).join('/')

      if (!pathToFolderId.has(subPath)) {
        const folderId = allocateTempFolderId(map.keys(), 'ai')
        pathToFolderId.set(subPath, folderId)

        const siblings = [...map.values()].filter(item => item.parentId === parentId)
        map.set(folderId, {
          node: {
            id: folderId,
            title: segment,
            parentId,
            index: siblings.length,
            children: []
          },
          parentId
        })
      }

      parentId = pathToFolderId.get(subPath)!
    }

    const leafFolderId = pathToFolderId.get(parts.join('/'))
    if (!leafFolderId) {
      continue
    }

    let siblingIndex = 0
    const placedInFolder = new Set<string>()
    for (const bookmarkId of entry.bookmarkIds) {
      const id = String(bookmarkId)
      if (placedInFolder.has(id)) {
        continue
      }
      placedInFolder.add(id)

      const flatEntry = map.get(id)
      if (!flatEntry || !isOrganizeBookmarkLeaf(flatEntry.node)) {
        continue
      }
      flatEntry.parentId = leafFolderId
      flatEntry.node.parentId = leafFolderId
      flatEntry.node.index = siblingIndex++
    }
  }
}

/**
 * 将 flat 映射转为 parentId 视图，供临时子树判断复用
 */
function toTempParentViewMap(
  map: Map<string, FlatBookmarkNode>
): Map<string, TempFolderParentView> {
  const view = new Map<string, TempFolderParentView>()
  for (const [id, entry] of map) {
    view.set(id, { parentId: entry.parentId })
  }
  return view
}

/**
 * 判断节点是否位于提案新建目录子树（temp_ai_* / temp_*，与手动编辑一致）
 */
function isInNewOrganizeFolderSubtree(nodeId: string, map: Map<string, FlatBookmarkNode>): boolean {
  return isNodeUnderTempFolderSubtree(nodeId, toTempParentViewMap(map), { aiOnly: false })
}

/**
 * 将仍未归入 AI 新目录的书签强制挂入兜底文件夹（prune 前修复，避免书签丢失）。
 */
function repairUnassignedOrganizeBookmarks(
  map: Map<string, FlatBookmarkNode>,
  bookmarkItems: OrganizeBookmarkSnapshot[],
  organizeRootParentId: string
): number {
  const idsToRepair: string[] = []

  for (const item of bookmarkItems) {
    const id = String(item.id)
    const entry = map.get(id)
    if (!entry || !isOrganizeBookmarkLeaf(entry.node)) {
      continue
    }
    if (!isInNewOrganizeFolderSubtree(id, map)) {
      idsToRepair.push(id)
    }
  }

  if (idsToRepair.length === 0) {
    return 0
  }

  const fallbackFolders = createFallbackFolderChain(
    map,
    ORGANIZE_FALLBACK_FOLDER_PATH,
    organizeRootParentId
  )
  const fallbackLeafId = fallbackFolders[fallbackFolders.length - 1]
  if (!fallbackLeafId) {
    return 0
  }

  let repairedCount = 0
  let siblingIndex = [...map.values()].filter(item => item.parentId === fallbackLeafId).length

  for (const id of idsToRepair) {
    const entry = map.get(id)
    if (!entry) {
      continue
    }

    entry.parentId = fallbackLeafId
    entry.node.parentId = fallbackLeafId
    entry.node.index = siblingIndex++
    repairedCount++
  }

  if (repairedCount > 0) {
    logger.warn(loggerPrefix, '已修复未挂载的整理书签', {
      repairedCount,
      fallbackPath: ORGANIZE_FALLBACK_FOLDER_PATH
    })
  }

  return repairedCount
}

/**
 * 确保兜底路径上的文件夹节点存在（如 其他/未分类）。
 */
function createFallbackFolderChain(
  map: Map<string, FlatBookmarkNode>,
  folderPath: string,
  organizeRootParentId: string
): string[] {
  const parts = normalizeOrganizePath(folderPath)
  if (parts.length === 0) {
    return []
  }

  const createdIds: string[] = []
  let parentId = organizeRootParentId

  for (const segment of parts) {
    const existing = [...map.entries()].find(
      ([id, entry]) =>
        isTempFolderId(id) &&
        entry.parentId === parentId &&
        entry.node.title === segment &&
        !isOrganizeBookmarkLeaf(entry.node)
    )

    if (existing) {
      parentId = existing[0]
      createdIds.push(existing[0])
      continue
    }

    const folderId = allocateTempFolderId(map.keys(), 'ai')
    const siblings = [...map.values()].filter(item => item.parentId === parentId)
    map.set(folderId, {
      node: {
        id: folderId,
        title: segment,
        parentId,
        index: siblings.length,
        children: []
      },
      parentId
    })
    parentId = folderId
    createdIds.push(folderId)
  }

  return createdIds
}

/**
 * 将 AI 整理结果合并进原始树，生成右侧提案树
 */
export function buildProposalTreeFromOrganizeResult(
  originalRoots: BookmarkNode[],
  folders: FolderStructure[],
  bookmarkItems: OrganizeBookmarkSnapshot[] = []
): BookmarkNode[] {
  if (folders.length === 0) {
    return originalRoots.map(root => cloneNode(root))
  }

  const clonedRoots = originalRoots.map(root => cloneNode(root))
  const map = flattenToMap(clonedRoots)
  seedMissingBookmarksIntoMap(map, bookmarkItems)

  applyFolderAssignments(map, folders, BOOKMARKS_BAR_ID)
  repairUnassignedOrganizeBookmarks(map, bookmarkItems, BOOKMARKS_BAR_ID)

  const expectedBookmarkIds = new Set(
    folders.flatMap(folder => folder.bookmarkIds.map(id => String(id)))
  )
  let assignedCount = 0
  for (const bookmarkId of expectedBookmarkIds) {
    const entry = map.get(bookmarkId)
    if (entry && isInNewOrganizeFolderSubtree(bookmarkId, map)) {
      assignedCount++
    }
  }

  logger.info(loggerPrefix, '提案树书签挂载完成', {
    folderCount: folders.length,
    expectedBookmarkCount: expectedBookmarkIds.size,
    assignedBookmarkCount: assignedCount
  })

  if (expectedBookmarkIds.size > 0 && assignedCount === 0) {
    logger.warn(loggerPrefix, 'AI 文件夹已生成但未挂载任何书签', {
      folderPaths: folders.map(folder => folder.path)
    })
  }

  const rebuilt = rebuildTreeFromMap(map)
  return pruneEmptiedLegacyBookmarksBarFolders(rebuilt, clonedRoots)
}
