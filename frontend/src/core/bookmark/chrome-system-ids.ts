/**
 * Chrome 书签树系统节点 ID（不可移动/删除/编辑）
 */

/** Chrome 根容器 ID */
export const CHROME_ROOT_ID = '0'

/** Chrome 书签栏 ID */
export const BOOKMARKS_BAR_ID = '1'

/** Chrome 其他书签 ID */
export const OTHER_BOOKMARKS_ID = '2'

/** Chrome 移动书签 ID（部分环境存在） */
export const MOBILE_BOOKMARKS_ID = '3'

/** Chrome 根节点：0=根容器，1=书签栏，2=其他书签，3=移动书签 */
export const CHROME_BOOKMARK_ROOT_IDS = new Set([
  CHROME_ROOT_ID,
  BOOKMARKS_BAR_ID,
  OTHER_BOOKMARKS_ID,
  MOBILE_BOOKMARKS_ID
])

/** 可显示在 UI 第一层的 Chrome 系统目录 */
export const CHROME_VISIBLE_ROOT_IDS = new Set([
  BOOKMARKS_BAR_ID,
  OTHER_BOOKMARKS_ID,
  MOBILE_BOOKMARKS_ID
])

/**
 * 是否为 Chrome 系统书签节点
 */
export function isChromeSystemBookmarkId(id: string): boolean {
  return CHROME_BOOKMARK_ROOT_IDS.has(id)
}

/**
 * 是否允许显示在 UI 第一层。
 */
export function isChromeVisibleRootId(id: string): boolean {
  return CHROME_VISIBLE_ROOT_IDS.has(id)
}

/**
 * 归一化可写操作的 parentId。
 *
 * Chrome 根容器不可作为普通书签/文件夹父级；非法根层目标统一落到书签栏。
 */
export function normalizeWritableBookmarkParentId(parentId?: string): string {
  if (!parentId || parentId === 'root' || parentId === 'virtual-root' || parentId === '0') {
    return BOOKMARKS_BAR_ID
  }
  if (parentId.startsWith('temp_')) {
    throw new Error(`目标文件夹尚未创建: ${parentId}`)
  }
  return parentId
}

/**
 * 规范化 parentId，便于 diff 比较（undefined / root / 0 视为等价）
 */
export function normalizeBookmarkParentId(parentId?: string): string {
  if (!parentId || parentId === 'root' || parentId === 'virtual-root') {
    return '0'
  }
  return parentId
}

export interface InvalidRootLayerNode {
  id: string
  title: string
  parentId: string
}

/**
 * 是否为挂在 Chrome 根容器下的异常普通节点（非系统目录 1/2/3）。
 */
export function isInvalidRootLayerNode(id: string, parentId?: string): boolean {
  const normalizedParent = parentId || CHROME_ROOT_ID
  return normalizedParent === CHROME_ROOT_ID && id !== CHROME_ROOT_ID && !isChromeVisibleRootId(id)
}

/**
 * 从扁平节点列表中检测异常根层普通节点。
 */
export function detectInvalidRootLayerNodes(
  nodes: Array<{ id: string; title?: string; parentId?: string | undefined }>
): InvalidRootLayerNode[] {
  return nodes
    .filter(node =>
      isInvalidRootLayerNode(String(node.id), node.parentId ? String(node.parentId) : undefined)
    )
    .map(node => ({
      id: String(node.id),
      title: node.title || '',
      parentId: String(node.parentId || CHROME_ROOT_ID)
    }))
}
