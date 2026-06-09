/**
 * 一键整理「应用更改」防护辅助函数（可单元测试）
 */

import type { BookmarkOperation } from '@/application/bookmark/bookmark-diff-service'

/**
 * Service Worker 冷启动等场景下可能出现的瞬时消息错误。
 */
export function isTransientMessageError(message: string): boolean {
  return (
    message.includes('message port closed') ||
    message.includes('Receiving end does not exist') ||
    message.includes('Extension context invalidated') ||
    message.includes('Could not establish connection')
  )
}

/**
 * 从 Chrome 书签树中回查近期创建的同名文件夹（用于创建响应丢失后的恢复）。
 */
export function findRecentFolderInTree(
  tree: chrome.bookmarks.BookmarkTreeNode[],
  parentId: string,
  title: string,
  since: number
): chrome.bookmarks.BookmarkTreeNode | null {
  const stack = [...tree]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) {
      continue
    }
    if (
      node.parentId === parentId &&
      node.title === title &&
      !node.url &&
      (node.dateAdded ?? 0) >= since - 2000
    ) {
      return node
    }
    if (node.children?.length) {
      stack.push(...node.children)
    }
  }
  return null
}

/**
 * 构建临时文件夹父子关系（仅 create folder 操作）。
 */
export function buildTempFolderChildrenMap(operations: BookmarkOperation[]): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>()
  for (const op of operations) {
    if (op.type === 'create' && op.isFolder && op.parentId.startsWith('temp_')) {
      const siblings = childrenByParent.get(op.parentId) ?? []
      siblings.push(op.nodeId)
      childrenByParent.set(op.parentId, siblings)
    }
  }
  return childrenByParent
}

/**
 * 将失败临时文件夹及其所有后代 temp 节点标记为阻断。
 */
export function markFailedTempSubtree(
  rootTempId: string,
  childrenByParent: Map<string, string[]>,
  failedTempIds: Set<string>
): void {
  const queue = [rootTempId]
  while (queue.length > 0) {
    const id = queue.pop()
    if (!id || failedTempIds.has(id)) {
      continue
    }
    failedTempIds.add(id)
    for (const childId of childrenByParent.get(id) ?? []) {
      queue.push(childId)
    }
  }
}

/**
 * 操作是否依赖已失败的临时文件夹（历史兼容；apply 已改为遇错即停）。
 */
export function operationDependsOnFailedTemp(
  operation: BookmarkOperation,
  failedTempIds: Set<string>
): boolean {
  if (failedTempIds.size === 0) {
    return false
  }

  if (operation.type === 'create') {
    return operation.parentId.startsWith('temp_') && failedTempIds.has(operation.parentId)
  }

  if (operation.type === 'move') {
    return operation.toParentId.startsWith('temp_') && failedTempIds.has(operation.toParentId)
  }

  return false
}
