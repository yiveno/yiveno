/**
 * 书签差异计算服务
 * 负责对比原始树和提案树，生成操作列表
 */

import type { BookmarkNode } from '@/types'
import {
  isChromeSystemBookmarkId,
  normalizeBookmarkParentId
} from '@/core/bookmark/chrome-system-ids'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签操作类型
 */
export type BookmarkOperationType = 'create' | 'move' | 'edit' | 'delete'

/**
 * 基础操作接口
 */
interface BaseOperation {
  type: BookmarkOperationType
  nodeId: string
  title: string
  isFolder: boolean
}

/**
 * 创建操作
 */
export interface CreateOperation extends BaseOperation {
  type: 'create'
  url?: string
  parentId: string
  index: number
}

/**
 * 移动操作
 */
export interface MoveOperation extends BaseOperation {
  type: 'move'
  fromParentId: string
  toParentId: string
  fromIndex: number
  toIndex: number
  isSameParent: boolean // 是否在同一文件夹内调整顺序
}

/**
 * 编辑操作
 */
export interface EditOperation extends BaseOperation {
  type: 'edit'
  oldTitle: string
  newTitle: string
  oldUrl?: string
  newUrl?: string
}

/**
 * 删除操作
 */
export interface DeleteOperation extends BaseOperation {
  type: 'delete'
  parentId: string
}

/**
 * 联合类型
 */
export type BookmarkOperation = CreateOperation | MoveOperation | EditOperation | DeleteOperation

/**
 * Diff 结果统计
 */
export interface DiffStatistics {
  total: number
  create: number
  move: number
  edit: number
  delete: number
  newFolders: number
  newBookmarks: number
}

/**
 * Diff 结果
 */
export interface DiffResult {
  operations: BookmarkOperation[]
  statistics: DiffStatistics
}

/**
 * 书签差异计算服务
 */
class BookmarkDiffService {
  /**
   * 计算两棵树的差异
   * @param original 原始树（来自 IndexedDB）
   * @param proposal 提案树（用户编辑后或 LLM 生成）
   * @param options.flatOriginalNodes 完整扁平节点集（优先 IndexedDB），避免懒加载树漏节点导致误判
   */
  calculateDiff(
    original: BookmarkNode,
    proposal: BookmarkNode,
    options?: { flatOriginalNodes?: Map<string, BookmarkNode> }
  ): DiffResult {
    logger.info('BookmarkDiffService', '🔍 开始计算差异')

    const { originalMap, proposalMap } = this.buildNodeMaps(original, proposal, options)

    logger.debug('BookmarkDiffService', '✅ 映射表构建完成', {
      originalCount: originalMap.size,
      proposalCount: proposalMap.size
    })

    const operations: BookmarkOperation[] = []
    this.detectDeletions(originalMap, proposalMap, operations)
    this.detectChanges(proposalMap, originalMap, operations)

    const withoutRedundantDeletes = this.filterRedundantDescendantDeletes(operations, originalMap)
    const filteredOperations = this.filterFalsePositiveMoves(withoutRedundantDeletes)
    const sortedOperations = this.sortOperations(filteredOperations)
    const statistics = this.calculateStatistics(sortedOperations)

    logger.info('BookmarkDiffService', '差异计算完成', statistics)

    return {
      operations: sortedOperations,
      statistics
    }
  }

  /**
   * 构建 ID -> Node 映射
   */
  private buildNodeMaps(
    original: BookmarkNode,
    proposal: BookmarkNode,
    options?: { flatOriginalNodes?: Map<string, BookmarkNode> }
  ): {
    originalMap: Map<string, BookmarkNode>
    proposalMap: Map<string, BookmarkNode>
  } {
    const originalMap = new Map<string, BookmarkNode>()
    const proposalMap = new Map<string, BookmarkNode>()

    if (options?.flatOriginalNodes) {
      for (const [id, node] of options.flatOriginalNodes) {
        originalMap.set(id, node)
      }
    } else {
      this.buildNodeMap(original, originalMap)
    }
    this.buildNodeMap(proposal, proposalMap)

    return { originalMap, proposalMap }
  }

  /**
   * 检测删除操作
   */
  private detectDeletions(
    originalMap: Map<string, BookmarkNode>,
    proposalMap: Map<string, BookmarkNode>,
    operations: BookmarkOperation[]
  ): void {
    for (const [id, node] of originalMap) {
      if (isChromeSystemBookmarkId(id)) {
        continue
      }
      if (!proposalMap.has(id)) {
        operations.push({
          type: 'delete',
          nodeId: id,
          title: node.title,
          isFolder: !node.url,
          parentId: node.parentId || 'root'
        })
      }
    }
  }

  /**
   * 检测新增、编辑、移动操作
   */
  private detectChanges(
    proposalMap: Map<string, BookmarkNode>,
    originalMap: Map<string, BookmarkNode>,
    operations: BookmarkOperation[]
  ): void {
    for (const [id, proposalNode] of proposalMap) {
      if (isChromeSystemBookmarkId(id)) {
        continue
      }
      const originalNode = originalMap.get(id)

      if (!originalNode) {
        this.handleNewNode(proposalNode, id, operations)
      } else {
        this.handleExistingNode(originalNode, proposalNode, id, operations)
      }
    }
  }

  /**
   * 处理新增节点
   */
  private handleNewNode(
    proposalNode: BookmarkNode,
    id: string,
    operations: BookmarkOperation[]
  ): void {
    operations.push({
      type: 'create',
      nodeId: id,
      title: proposalNode.title,
      isFolder: !proposalNode.url,
      parentId: proposalNode.parentId || 'root',
      index: proposalNode.index ?? 0,
      ...(proposalNode.url !== undefined ? { url: proposalNode.url } : {})
    })
  }

  /**
   * 处理已存在的节点（检测编辑和移动）
   */
  private handleExistingNode(
    originalNode: BookmarkNode,
    proposalNode: BookmarkNode,
    id: string,
    operations: BookmarkOperation[]
  ): void {
    this.detectEdit(originalNode, proposalNode, id, operations)
    this.detectMove(originalNode, proposalNode, id, operations)
  }

  /**
   * 检测编辑操作
   */
  private detectEdit(
    originalNode: BookmarkNode,
    proposalNode: BookmarkNode,
    id: string,
    operations: BookmarkOperation[]
  ): void {
    const titleChanged = originalNode.title !== proposalNode.title
    const urlChanged = originalNode.url !== proposalNode.url

    if (titleChanged || urlChanged) {
      operations.push({
        type: 'edit',
        nodeId: id,
        title: proposalNode.title,
        isFolder: !proposalNode.url,
        oldTitle: originalNode.title,
        newTitle: proposalNode.title,
        ...(originalNode.url !== undefined ? { oldUrl: originalNode.url } : {}),
        ...(proposalNode.url !== undefined ? { newUrl: proposalNode.url } : {})
      })
    }
  }

  /**
   * 检测移动操作
   */
  private detectMove(
    originalNode: BookmarkNode,
    proposalNode: BookmarkNode,
    id: string,
    operations: BookmarkOperation[]
  ): void {
    if (isChromeSystemBookmarkId(id)) {
      return
    }

    const originalParent = normalizeBookmarkParentId(originalNode.parentId)
    const proposalParent = normalizeBookmarkParentId(proposalNode.parentId)
    const parentChanged = originalParent !== proposalParent
    const indexChanged = originalNode.index !== proposalNode.index

    if (parentChanged) {
      this.handleCrossFolderMove(originalNode, proposalNode, id, operations)
    } else if (indexChanged) {
      this.handleSameParentMove(originalNode, proposalNode, id, operations)
    }
  }

  /**
   * 处理跨文件夹移动
   */
  private handleCrossFolderMove(
    originalNode: BookmarkNode,
    proposalNode: BookmarkNode,
    id: string,
    operations: BookmarkOperation[]
  ): void {
    logger.debug('BookmarkDiffService', '📦 检测到跨文件夹移动', {
      title: proposalNode.title,
      from: originalNode.parentId || 'root',
      to: proposalNode.parentId || 'root'
    })
    operations.push({
      type: 'move',
      nodeId: id,
      title: proposalNode.title,
      isFolder: !proposalNode.url,
      fromParentId: originalNode.parentId || 'root',
      toParentId: proposalNode.parentId || 'root',
      fromIndex: originalNode.index ?? 0,
      toIndex: proposalNode.index ?? 0,
      isSameParent: false
    })
  }

  /**
   * 处理同父节点内移动
   */
  private handleSameParentMove(
    originalNode: BookmarkNode,
    proposalNode: BookmarkNode,
    id: string,
    operations: BookmarkOperation[]
  ): void {
    logger.debug('BookmarkDiffService', '🔄 检测到同级 index 变化', {
      title: proposalNode.title,
      parentId: originalNode.parentId || 'root',
      fromIndex: originalNode.index,
      toIndex: proposalNode.index,
      delta: (proposalNode.index ?? 0) - (originalNode.index ?? 0)
    })
    operations.push({
      type: 'move',
      nodeId: id,
      title: proposalNode.title,
      isFolder: !proposalNode.url,
      fromParentId: originalNode.parentId || 'root',
      toParentId: proposalNode.parentId || 'root',
      fromIndex: originalNode.index ?? 0,
      toIndex: proposalNode.index ?? 0,
      isSameParent: true
    })
  }

  /**
   * 过滤掉"整体偏移"造成的假移动
   *
   * 场景：当一个节点插入到列表中间时，后面的节点 index 都会 +1
   * 但这些节点实际上没有"移动"，不需要调用 Chrome API
   */
  private filterFalsePositiveMoves(operations: BookmarkOperation[]): BookmarkOperation[] {
    logger.info('BookmarkDiffService', '🧹 开始过滤整体偏移')

    // 按 parentId 分组同级移动操作
    const movesByParent = new Map<string, MoveOperation[]>()
    const otherOperations: BookmarkOperation[] = []

    for (const op of operations) {
      if (op.type === 'move' && op.isSameParent) {
        const parentId = op.fromParentId
        if (!movesByParent.has(parentId)) {
          movesByParent.set(parentId, [])
        }
        movesByParent.get(parentId)!.push(op as MoveOperation)
      } else {
        otherOperations.push(op)
      }
    }

    logger.debug('BookmarkDiffService', '📊 同级移动分组统计', {
      totalGroups: movesByParent.size,
      groups: Array.from(movesByParent.entries()).map(([parentId, moves]) => ({
        parentId,
        count: moves.length
      }))
    })

    // 检查每个父节点下的移动操作
    const genuineMoves: BookmarkOperation[] = []
    let filteredCount = 0

    for (const [parentId, moves] of movesByParent) {
      // 计算每个节点的 index 变化值
      const indexDeltas = moves.map(m => m.toIndex - m.fromIndex)

      // 检查是否所有变化值都相同（整体偏移）
      const allSame = indexDeltas.every(delta => delta === indexDeltas[0])

      if (allSame && indexDeltas.length > 1) {
        // 整体偏移：所有节点的 index 都增加/减少相同的值
        // 这是因为其他节点插入/删除造成的连锁反应，不算真正的移动
        logger.info('BookmarkDiffService', `🚫 过滤整体偏移（parentId=${parentId}）`, {
          filteredCount: moves.length,
          delta: indexDeltas[0],
          affectedNodes: moves.map(m => m.title).slice(0, 5), // 只显示前5个
          more: moves.length > 5 ? `... 还有 ${moves.length - 5} 个` : ''
        })
        filteredCount += moves.length
        // 不添加到 genuineMoves
      } else {
        // 非整体偏移：真正的位置调换
        logger.debug('BookmarkDiffService', `✅ 保留真实移动（parentId=${parentId}）`, {
          count: moves.length,
          nodes: moves.map(m => ({
            title: m.title,
            from: m.fromIndex,
            to: m.toIndex,
            delta: m.toIndex - m.fromIndex
          }))
        })
        genuineMoves.push(...moves)
      }
    }

    logger.info('BookmarkDiffService', '✅ 过滤完成', {
      originalMoveCount: Array.from(movesByParent.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      filteredCount,
      remainingMoveCount: genuineMoves.length,
      otherOperationsCount: otherOperations.length
    })

    return [...otherOperations, ...genuineMoves]
  }

  /**
   * 过滤被祖先文件夹递归删除覆盖的后代删除操作。
   *
   * Chrome removeTree 会一次性删除整棵子树；如果继续删除子节点，会得到
   * "Can't find bookmark for id."。
   */
  private filterRedundantDescendantDeletes(
    operations: BookmarkOperation[],
    originalMap: Map<string, BookmarkNode>
  ): BookmarkOperation[] {
    const deletedFolderIds = new Set(
      operations
        .filter((op): op is DeleteOperation => op.type === 'delete' && op.isFolder)
        .map(op => op.nodeId)
    )

    if (deletedFolderIds.size === 0) {
      return operations
    }

    let filteredCount = 0
    const filtered = operations.filter(op => {
      if (op.type !== 'delete') {
        return true
      }

      let parentId = originalMap.get(op.nodeId)?.parentId
      const visited = new Set<string>()

      while (parentId && !visited.has(parentId)) {
        if (deletedFolderIds.has(parentId)) {
          filteredCount++
          return false
        }
        visited.add(parentId)
        parentId = originalMap.get(parentId)?.parentId
      }

      return true
    })

    if (filteredCount > 0) {
      logger.info('BookmarkDiffService', '已过滤祖先删除覆盖的后代删除操作', {
        filteredCount
      })
    }

    return filtered
  }

  /**
   * 递归构建节点映射表
   */
  private buildNodeMap(node: BookmarkNode, map: Map<string, BookmarkNode>): void {
    map.set(node.id, node)

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.buildNodeMap(child, map)
      }
    }
  }

  /**
   * 排序操作：删除 → 移动 → 编辑 → 新增
   */
  private sortOperations(operations: BookmarkOperation[]): BookmarkOperation[] {
    const order: Record<BookmarkOperationType, number> = {
      delete: 1,
      move: 2,
      edit: 3,
      create: 4
    }

    return operations.sort((a, b) => {
      const orderDiff = order[a.type] - order[b.type]
      if (orderDiff !== 0) return orderDiff

      // 同类型操作：文件夹优先于书签
      const aFolderWeight = a.isFolder ? 0 : 1
      const bFolderWeight = b.isFolder ? 0 : 1
      return aFolderWeight - bFolderWeight
    })
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(operations: BookmarkOperation[]): DiffStatistics {
    const stats: DiffStatistics = {
      total: operations.length,
      create: 0,
      move: 0,
      edit: 0,
      delete: 0,
      newFolders: 0,
      newBookmarks: 0
    }

    for (const op of operations) {
      stats[op.type]++

      if (op.type === 'create') {
        if (op.isFolder) {
          stats.newFolders++
        } else {
          stats.newBookmarks++
        }
      }
    }

    return stats
  }

  /**
   * 按操作类型分组
   */
  groupOperationsByType(
    operations: BookmarkOperation[]
  ): Record<BookmarkOperationType, BookmarkOperation[]> {
    return {
      create: operations.filter(op => op.type === 'create'),
      move: operations.filter(op => op.type === 'move'),
      edit: operations.filter(op => op.type === 'edit'),
      delete: operations.filter(op => op.type === 'delete')
    }
  }

  /**
   * 管理页提案 diff 后处理：过滤虚拟根、Chrome 系统节点与临时节点噪音
   */
  postProcessManagementProposalDiff(
    diff: DiffResult,
    proposalChildren: BookmarkNode[]
  ): DiffResult {
    let filteredOperations = diff.operations.filter(
      op => op.nodeId !== 'virtual-root' && !isChromeSystemBookmarkId(op.nodeId)
    )

    const tempNodeIds = this.collectTempNodeIds(proposalChildren)

    if (tempNodeIds.size > 0) {
      logger.info('BookmarkDiffService', '检测到临时文件夹，应用时将先创建文件夹', {
        tempNodeCount: tempNodeIds.size
      })

      filteredOperations = filteredOperations.filter(op => {
        if (op.type === 'create' && op.nodeId.startsWith('temp_') && op.isFolder) {
          return true
        }
        if (op.type === 'create' && op.nodeId.startsWith('temp_') && !op.isFolder) {
          return false
        }
        if (tempNodeIds.has(op.nodeId) && op.type !== 'create') {
          return false
        }
        return true
      })
    }

    const statistics = this.calculateStatistics(filteredOperations)

    logger.info('BookmarkDiffService', '管理页 diff 后处理完成', {
      ...statistics,
      filteredTempNodes: tempNodeIds.size
    })

    return { operations: filteredOperations, statistics }
  }

  /** 收集提案树中的临时节点 ID */
  private collectTempNodeIds(nodes: BookmarkNode[]): Set<string> {
    const ids = new Set<string>()
    const walk = (list: BookmarkNode[]) => {
      for (const node of list) {
        if (node.id.startsWith('temp_')) {
          ids.add(node.id)
        }
        if (node.children?.length) {
          walk(node.children)
        }
      }
    }
    walk(nodes)
    return ids
  }
}

/**
 * 导出单例
 */
export const bookmarkDiffService = new BookmarkDiffService()
