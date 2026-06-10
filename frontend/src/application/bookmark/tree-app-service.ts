/**
 * 应用层：书签树构建服务
 *
 * 将 IndexedDB 扁平记录转换为 UI 可用的树结构。
 */
import type { BookmarkNode, BookmarkRecord } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import { isChromeVisibleRootId, isInvalidRootLayerNode } from '@/core/bookmark/chrome-system-ids'

export const treeAppService = {
  /** 将扁平记录构建为通用 UI 书签树 */
  buildViewTreeFromFlat(records: BookmarkRecord[]): BookmarkNode[] {
    if (!Array.isArray(records) || records.length === 0) return []

    const t0 = performance.now()
    const items = records.slice()
    const t1 = performance.now()

    const nodeMap = new Map<string, BookmarkNode>()
    const toNode = (item: BookmarkRecord): BookmarkNode => ({
      id: String(item.id),
      title: item.title,
      url: item.url,
      children: item.url ? undefined : [],
      parentId: item.parentId ? String(item.parentId) : undefined,
      index: typeof item.index === 'number' ? item.index : undefined,
      pathIds: Array.isArray(item.pathIds)
        ? item.pathIds.map((x: string | number) => String(x))
        : undefined,
      ancestorIds: Array.isArray(item.ancestorIds)
        ? item.ancestorIds.map((x: string | number) => String(x))
        : undefined,
      depth: typeof item.depth === 'number' ? item.depth : undefined,
      domain: typeof item.domain === 'string' ? item.domain : undefined,
      titleLower: typeof item.titleLower === 'string' ? item.titleLower : undefined,
      urlLower: typeof item.urlLower === 'string' ? item.urlLower : undefined,
      childrenCount: typeof item.childrenCount === 'number' ? item.childrenCount : undefined,
      traitTags: Array.isArray(item.traitTags) ? item.traitTags : undefined,
      traitMetadata: Array.isArray(item.traitMetadata)
        ? (item.traitMetadata as Array<{
            tag: 'duplicate' | 'invalid' | 'internal'
            detectedAt: number
            source: 'worker' | 'user' | 'imported'
            notes?: string
          }>)
        : undefined,
      isFavorite: item.isFavorite === true,
      favoriteOrder: typeof item.favoriteOrder === 'number' ? item.favoriteOrder : undefined
    })

    for (const it of items) nodeMap.set(String(it.id), toNode(it))
    const t2 = performance.now()
    logger.debug(
      'TreeAppService',
      'buildViewTreeFromFlat',
      `节点映射构建完成，耗时 ${(t2 - t1).toFixed(0)}ms`
    )

    const childIds = new Set<string>()
    for (const it of items) {
      const id = String(it.id)
      const parentId = it.parentId ? String(it.parentId) : undefined
      if (parentId && nodeMap.has(parentId) && parentId !== '0') {
        const parent = nodeMap.get(parentId)!
        const node = nodeMap.get(id)!
        if (parent.children) parent.children.push(node)
        childIds.add(id)
      }
    }
    const t3 = performance.now()
    logger.debug(
      'TreeAppService',
      'buildViewTreeFromFlat',
      `父子关系构建完成，耗时 ${(t3 - t2).toFixed(0)}ms`
    )

    const roots: BookmarkNode[] = []
    const rootIds = new Set<string>()
    const invalidRootNodes: Array<{ id: string; title: string; parentId?: string }> = []
    for (const it of items) {
      const id = String(it.id)
      if (isChromeVisibleRootId(id) && !childIds.has(id) && !rootIds.has(id)) {
        const node = nodeMap.get(id)
        if (node) {
          roots.push(node)
          rootIds.add(id)
        }
        continue
      }

      const parentId = it.parentId ? String(it.parentId) : undefined
      if (isInvalidRootLayerNode(id, parentId)) {
        invalidRootNodes.push({
          id,
          title: it.title,
          ...(parentId !== undefined ? { parentId } : {})
        })
      }
    }

    if (invalidRootNodes.length > 0) {
      logger.warn('TreeAppService', '检测到异常根层普通节点，已从 UI 第一层过滤', {
        count: invalidRootNodes.length,
        nodes: invalidRootNodes.slice(0, 10)
      })
    }

    const t4 = performance.now()
    logger.debug(
      'TreeAppService',
      'buildViewTreeFromFlat',
      `根节点列表构建完成，耗时 ${(t4 - t3).toFixed(0)}ms，${roots.length} 个根节点`
    )
    logger.debug('TreeAppService', 'buildViewTreeFromFlat', `总耗时 ${(t4 - t0).toFixed(0)}ms`)

    return roots
  }
}
