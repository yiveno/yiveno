/**
 * 特征快捷筛选（树形裁剪）
 */

import type { BookmarkNode } from '@/types'

/** 内置特征筛选 ID */
export const TRAIT_QUICK_FILTER_IDS = ['invalid', 'duplicate'] as const

export type TraitQuickFilterId = (typeof TRAIT_QUICK_FILTER_IDS)[number]

/**
 * 判断节点是否匹配单个特征筛选器
 */
export function traitNodeMatchesFilter(node: BookmarkNode, filterId: string): boolean {
  if (filterId === 'invalid') {
    const isRootNode = !node.parentId || node.parentId === '0'
    if (isRootNode) return false
    return node.traitTags?.includes('invalid') ?? false
  }

  if (filterId === 'duplicate') {
    return node.traitTags?.includes('duplicate') ?? false
  }

  return false
}

/**
 * 在树形结构上应用特征快捷筛选（AND 关系）
 */
export function applyTraitFiltersToTree(
  nodes: BookmarkNode[],
  filterIds: string[]
): BookmarkNode[] {
  if (filterIds.length === 0) {
    return nodes
  }

  const activeFilterIds = filterIds.filter(id =>
    TRAIT_QUICK_FILTER_IDS.includes(id as TraitQuickFilterId)
  )
  if (activeFilterIds.length === 0) {
    return nodes
  }

  function filterNodes(nodeList: BookmarkNode[]): BookmarkNode[] {
    const result: BookmarkNode[] = []

    for (const node of nodeList) {
      const matchesAllFilters = activeFilterIds.every(id => traitNodeMatchesFilter(node, id))

      if (node.children && node.children.length > 0) {
        const filteredChildren = filterNodes(node.children)
        if (filteredChildren.length > 0 || matchesAllFilters) {
          result.push({
            ...node,
            children: filteredChildren
          })
        }
        continue
      }

      if (matchesAllFilters) {
        result.push(node)
      }
    }

    return result
  }

  return filterNodes(nodes)
}
