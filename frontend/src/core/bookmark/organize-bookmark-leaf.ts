/**
 * 一键整理场景下的书签叶子判定（URL 非必填）
 */

import type { BookmarkNode } from '@/types'

/**
 * 是否为书签叶子节点（含无 URL / 空 URL；文件夹无 url 字段）
 */
export function isOrganizeBookmarkLeaf(node: BookmarkNode): boolean {
  if (node.isFolder === true) {
    return false
  }
  return typeof node.url === 'string'
}
