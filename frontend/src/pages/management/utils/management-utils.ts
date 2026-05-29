import type { BookmarkNode } from '@/types'
import type {
  BookmarkOperation,
  BookmarkOperationType
} from '@/application/bookmark/bookmark-diff-service'

/**
 * 读取 Material Web TextField 的值。
 */
export function readMwcTextFieldValue(ev: Event): string {
  const el = ev.target as unknown as { value?: string }
  return typeof el.value === 'string' ? el.value : ''
}

/**
 * 检查 URL 是否为浏览器内部协议。
 */
export function isInternalProtocolUrl(url: string): boolean {
  if (!url) return false

  const lowerUrl = url.toLowerCase()
  return (
    lowerUrl.startsWith('chrome://') ||
    lowerUrl.startsWith('chrome-extension://') ||
    lowerUrl.startsWith('about:') ||
    lowerUrl.startsWith('file://') ||
    lowerUrl.startsWith('edge://') ||
    lowerUrl.startsWith('brave://')
  )
}

/**
 * 递归收集文件夹中的所有书签。
 */
export function collectBookmarksFromFolder(
  folder: BookmarkNode,
  visited: Set<string> = new Set(),
  depth = 0,
  maxDepth = 50
): BookmarkNode[] {
  const bookmarks: BookmarkNode[] = []

  if (depth > maxDepth) {
    return bookmarks
  }

  if (visited.has(folder.id)) {
    return bookmarks
  }

  visited.add(folder.id)

  if (!folder.children) {
    return bookmarks
  }

  for (const child of folder.children) {
    if (child.url) {
      bookmarks.push(child)
    } else if (child.children) {
      bookmarks.push(...collectBookmarksFromFolder(child, visited, depth + 1, maxDepth))
    }
  }

  return bookmarks
}

/**
 * 按类型过滤操作列表。
 */
export function getOperationsByType(
  operations: BookmarkOperation[],
  type: BookmarkOperationType
): BookmarkOperation[] {
  return operations.filter(operation => operation.type === type)
}

interface BookmarkIndexLike {
  getNode(id: string): BookmarkNode | undefined
  getChildrenIds(id: string): Iterable<string>
}

function isTopLevelRootNode(node: BookmarkNode): boolean {
  return !node.parentId || node.parentId === '0' || node.id === '1' || node.id === '2'
}

function visitSelectedNode(
  index: BookmarkIndexLike,
  nodeId: string,
  rootId: string,
  bookmarkIds: Set<string>,
  selectedFolderIds: Set<string>,
  visited: Set<string>
): void {
  if (visited.has(nodeId)) return
  visited.add(nodeId)

  const node = index.getNode(nodeId)
  if (!node) return

  if (node.url) {
    bookmarkIds.add(nodeId)
    return
  }

  if (nodeId !== rootId && !isTopLevelRootNode(node)) {
    selectedFolderIds.add(nodeId)
  }

  for (const childId of index.getChildrenIds(nodeId)) {
    visitSelectedNode(index, String(childId), rootId, bookmarkIds, selectedFolderIds, visited)
  }
}

/**
 * 统计选中节点中的书签和文件夹数量。
 */
export function countSelectedNodes(
  index: BookmarkIndexLike,
  selectedIds: readonly string[]
): { bookmarks: number; folders: number } {
  const bookmarkIds = new Set<string>()
  const selectedFolderIds = new Set<string>()
  const visited = new Set<string>()

  for (const rawId of selectedIds) {
    visitSelectedNode(index, String(rawId), String(rawId), bookmarkIds, selectedFolderIds, visited)
  }

  return {
    bookmarks: bookmarkIds.size,
    folders: selectedFolderIds.size
  }
}
