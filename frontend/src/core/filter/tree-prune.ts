/**
 * 书签树裁剪（纯函数）
 *
 * 按书签 ID 集合与文件夹标题关键字裁剪树，保留匹配节点及其祖先路径。
 */

import type { BookmarkNode } from '@/types'

export interface PruneBookmarkTreeOptions {
  /** 命中的书签 ID 集合（叶子节点） */
  matchedBookmarkIds?: ReadonlySet<string>
  /** 文件夹标题文本匹配（补充提案侧仅存在于新文件夹名的场景） */
  folderTitleQuery?: string
}

/**
 * 统计树中书签叶子数量
 */
export function countBookmarkLeaves(nodes: BookmarkNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.url) {
      count += 1
      continue
    }
    if (node.children?.length) {
      count += countBookmarkLeaves(node.children)
    }
  }
  return count
}

function normalizeFolderQuery(query: string | undefined): string {
  return (query ?? '').trim().toLowerCase()
}

function folderTitleMatches(node: BookmarkNode, normalizedQuery: string): boolean {
  if (node.url || !normalizedQuery) return false
  return (node.title || '').toLowerCase().includes(normalizedQuery)
}

function bookmarkIdMatches(
  node: BookmarkNode,
  matchedIds: ReadonlySet<string> | undefined
): boolean {
  if (!node.url || !matchedIds || matchedIds.size === 0) return false
  return matchedIds.has(String(node.id))
}

function cloneBookmarkLeaf(node: BookmarkNode): BookmarkNode {
  const leaf = { ...node }
  delete leaf.children
  return leaf
}

/**
 * 裁剪书签树：保留 ID 命中或文件夹标题命中分支
 */
export function pruneBookmarkTree(
  nodes: BookmarkNode[],
  options: PruneBookmarkTreeOptions = {}
): BookmarkNode[] {
  const matchedIds = options.matchedBookmarkIds
  const normalizedFolderQuery = normalizeFolderQuery(options.folderTitleQuery)
  const hasIdCriteria = Boolean(matchedIds && matchedIds.size > 0)
  const hasFolderCriteria = normalizedFolderQuery.length > 0

  if (!hasIdCriteria && !hasFolderCriteria) {
    return nodes
  }

  function pruneRecursive(nodeList: BookmarkNode[]): BookmarkNode[] {
    const results: BookmarkNode[] = []

    for (const node of nodeList) {
      const childMatches = node.children ? pruneRecursive(node.children) : []
      const selfBookmarkMatch = bookmarkIdMatches(node, matchedIds)
      const selfFolderMatch = folderTitleMatches(node, normalizedFolderQuery)

      if (!selfBookmarkMatch && !selfFolderMatch && childMatches.length === 0) {
        continue
      }

      if (node.url) {
        results.push(cloneBookmarkLeaf(node))
        continue
      }

      const resultNode: BookmarkNode = { ...node }

      if (selfFolderMatch) {
        // 文件夹标题命中：仍只保留裁剪后的子节点，避免泄漏完整子树
        resultNode.children = childMatches.length > 0 ? childMatches : []
      } else if (childMatches.length > 0) {
        resultNode.children = childMatches
      } else {
        resultNode.children = []
      }

      results.push(resultNode)
    }

    return results
  }

  return pruneRecursive(nodes)
}
