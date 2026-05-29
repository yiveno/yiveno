/**
 * 书签内存搜索服务（Application 层）
 *
 * 专门处理内存中的书签树形数据搜索，用于：
 * - 已编辑但未保存的数据（Management 页面左右面板对比）
 * - LLM 返回的临时数据
 * - 任何不需要走 IndexedDB 的内存书签数据
 *
 * 注意：此服务只做内存树形筛选，不支持语义搜索。
 * IndexedDB 搜索请使用 bookmarkSearchService。
 *
 * @module application/query/bookmark-memory-search-service
 */

import {
  filterBookmarkNodes,
  flattenFilterResults,
  highlightMatches,
  recalculateChildrenCount,
  type BookmarkFilterOptions,
  type FilteredBookmarkNode
} from '@/core/filter/bookmark-filter'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 内存搜索结果
 */
export interface MemorySearchResult {
  /** 搜索后的树形节点 */
  nodes: FilteredBookmarkNode[]
  /** 总结果数（叶子节点数量） */
  total: number
  /** 执行时间（毫秒） */
  executionTime: number
}

/**
 * 书签内存搜索服务类
 */
class BookmarkMemorySearchService {
  /**
   * 在内存书签树中搜索（同步）
   *
   * @param nodes - 书签节点数组（树形结构）
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 搜索结果（保留树形结构，匹配节点高亮）
   */
  search(
    nodes: BookmarkNode[],
    query: string,
    options: BookmarkFilterOptions = {}
  ): MemorySearchResult {
    const startTime = performance.now()

    try {
      let filteredNodes = filterBookmarkNodes(nodes, query, options)
      filteredNodes = recalculateChildrenCount(filteredNodes)

      const flattenedResults = flattenFilterResults(filteredNodes)
      const total = flattenedResults.length
      const executionTime = Math.round(performance.now() - startTime)

      logger.info('BookmarkMemorySearchService', `内存搜索完成: "${query}"`, {
        total,
        executionTime
      })

      return { nodes: filteredNodes, total, executionTime }
    } catch (error) {
      logger.error('BookmarkMemorySearchService', '内存搜索失败', error)
      throw error
    }
  }

  /**
   * 扁平化搜索结果（树形 → 列表）
   */
  flatten(nodes: FilteredBookmarkNode[]): FilteredBookmarkNode[] {
    return flattenFilterResults(nodes)
  }

  /**
   * 高亮匹配文本
   */
  highlight(
    text: string,
    query: string,
    caseSensitive = false
  ): Array<{ text: string; highlighted: boolean }> {
    return highlightMatches(text, query, caseSensitive)
  }
}

/** 全局唯一书签内存搜索服务实例 */
export const bookmarkMemorySearchService = new BookmarkMemorySearchService()

// 导出类型
export type { BookmarkFilterOptions, FilteredBookmarkNode }
