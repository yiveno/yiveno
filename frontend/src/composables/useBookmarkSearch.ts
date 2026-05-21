/**
 * useBookmarkSearch Composable
 *
 * 提供响应式的书签筛选功能
 * - 封装 bookmarkFilterService（底层实现）
 * - 自动转换筛选结果为 BookmarkNode[]
 * - 管理筛选状态
 *
 * 注意：本项目中使用「筛选」而非「搜索」
 * - 所有数据都在本地 IndexedDB
 * - 不存在网络请求
 * - 从已有集合中过滤符合条件的书签
 *
 * @example
 * ```typescript
 * const {
 *   query,
 *   results,
 *   bookmarkNodes,
 *   isFiltering,
 *   filter,
 *   clear
 * } = useBookmarkSearch({ limit: 50 })
 *
 * // 筛选
 * await filter('React')
 *
 * // 使用结果
 * console.log(bookmarkNodes.value) // BookmarkNode[]
 * ```
 */

import { ref, computed, watch } from 'vue'
import { bookmarkMemorySearchService } from '@/application/query/bookmark-memory-search-service'
import type {
  FilteredBookmarkNode,
  BookmarkFilterOptions
} from '@/application/query/bookmark-memory-search-service'
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import type { BookmarkNode } from '@/types'
import type { SearchStrategy } from '@/types/domain/query'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Composable 选项
 */
export interface UseBookmarkSearchOptions {
  /**
   * 筛选模式
   * - indexeddb: 从 IndexedDB 筛选（异步）
   * - memory: 从内存数据筛选（同步）
   */
  mode?: 'indexeddb' | 'memory'

  /**
   * 搜索策略（仅 indexeddb 模式有效）
   * - auto: 自动根据输入意图选择（默认）
   * - fuse: 本地 Fuse.js 模糊匹配
   * - semantic: 本地语义向量搜索
   * - hybrid: Fuse 立即返回 + Semantic 异步合并
   */
  strategy?: SearchStrategy

  /**
   * 内存数据源
   * - mode='memory' 时使用
   * - 可以是 Ref 或普通数组
   */
  data?: Ref<BookmarkNode[]> | BookmarkNode[]

  /** 筛选结果数量限制 */
  limit?: number

  /** 是否自动筛选（当 query 变化时） */
  autoFilter?: boolean

  /** 初始筛选条件 */
  initialQuery?: string

  /** 筛选选项 */
  filterOptions?: Partial<BookmarkFilterOptions>
}

/**
 * Composable 返回值
 */
export interface UseBookmarkSearchReturn {
  /** 筛选条件 */
  query: Ref<string>

  /** 筛选结果 */
  results: Ref<FilteredBookmarkNode[]>

  /** 筛选结果（BookmarkNode 格式） */
  bookmarkNodes: Ref<BookmarkNode[]>

  /** 是否正在筛选 */
  isFiltering: Ref<boolean>

  /** 筛选错误 */
  error: Ref<Error | null>

  /** 总结果数 */
  totalResults: Ref<number>

  /** 执行时间（毫秒） */
  executionTime: Ref<number>

  /** 筛选数据源 */
  filterSource: Ref<'indexeddb' | 'memory'>

  /** 执行筛选 */
  filter: (q: string) => Promise<void>

  /** 清空筛选结果 */
  clear: () => void

  /** 重新筛选（使用当前 query） */
  refresh: () => Promise<void>
}

/**
 * 书签筛选 Composable
 */
export function useBookmarkSearch(
  options: UseBookmarkSearchOptions = {}
): UseBookmarkSearchReturn {
  const {
    mode = 'indexeddb',
    strategy = 'auto',
    data,
    limit = 100,
    autoFilter = true,
    initialQuery = '',
    filterOptions = {}
  } = options

  // 将 data 转换为 Ref
  const dataRef = ref(data)

  // ==================== State ====================
  const query = ref(initialQuery)
  const results = ref<FilteredBookmarkNode[]>([])
  const isFiltering = ref(false)
  const error = ref<Error | null>(null)
  const totalResults = ref(0)
  const executionTime = ref(0)
  const filterSource = ref<'indexeddb' | 'memory'>(mode)

  // ==================== Computed ====================
  /**
   * 筛选结果即为 BookmarkNode 格式
   * FilteredBookmarkNode 继承自 BookmarkNode
   */
  const bookmarkNodes = computed((): BookmarkNode[] => {
    return results.value
  })

  // ==================== Methods ====================
  /**
   * 执行筛选（支持双模式）
   */
  async function filter(q: string): Promise<void> {
    const trimmedQuery = q.trim()

    // 更新 query
    query.value = q

    // 空查询，清空结果
    if (!trimmedQuery) {
      clear()
      return
    }

    // 验证：memory 模式下必须提供 data
    if (mode === 'memory' && (!dataRef.value || dataRef.value.length === 0)) {
      logger.warn('useBookmarkSearch', '内存模式下未提供数据源，跳过筛选')
      clear()
      return
    }

    isFiltering.value = true
    error.value = null

    try {
      if (mode === 'memory') {
        // 内存模式：使用 bookmarkMemorySearchService（树形结构筛选）
        const result = bookmarkMemorySearchService.search(
          dataRef.value as BookmarkNode[],
          trimmedQuery,
          { limit, ...filterOptions }
        )
        results.value = result.nodes
        totalResults.value = result.total
        executionTime.value = result.executionTime
        filterSource.value = 'memory'
      } else {
        // IndexedDB 模式：通过 bookmarkSearchService，支持 strategy
        const result = await bookmarkSearchService.searchWithMetadata(trimmedQuery, {
          strategy,
          limit,
          highlight: true,
          filterFolders: filterOptions.filterFolders,
          fuzzyThreshold: filterOptions.threshold
        })

        if (!result.ok) {
          throw result.error
        }

        const response = result.value

        // 转换为 FilteredBookmarkNode（扁平列表）
        const nodes: FilteredBookmarkNode[] = response.results.map(r => ({
          id: r.bookmark.id,
          title: r.bookmark.title || '无标题',
          url: r.bookmark.url,
          dateAdded: r.bookmark.dateAdded || 0,
          dateGroupModified: r.bookmark.dateGroupModified,
          parentId: r.bookmark.parentId,
          index: r.bookmark.index || 0,
          children: !r.bookmark.url ? [] : undefined,
          matchedFields: r.matchedFields,
          filterScore: r.score,
          path: r.bookmark.path || [],
          pathString: r.bookmark.pathString || '',
          pathIds: r.bookmark.pathIds || [],
          pathIdsString: r.bookmark.pathIdsString || '',
          ancestorIds: r.bookmark.ancestorIds || [],
          siblingIds: r.bookmark.siblingIds || [],
          depth: r.bookmark.depth || 0,
          titleLower: r.bookmark.titleLower || r.bookmark.title?.toLowerCase() || '',
          urlLower: r.bookmark.urlLower || r.bookmark.url?.toLowerCase(),
          domain: r.bookmark.domain,
          keywords: r.bookmark.keywords || [],
          isFolder: !r.bookmark.url,
          childrenCount: r.bookmark.childrenCount || 0
        } as FilteredBookmarkNode))

        results.value = nodes
        totalResults.value = response.metadata.totalResults
        executionTime.value = Math.round(response.metadata.searchTime)
        filterSource.value = 'indexeddb'
      }

      logger.info(
        'useBookmarkSearch',
        `筛选完成 (${filterSource.value}, strategy=${strategy}): "${trimmedQuery}"`,
        { total: totalResults.value, executionTime: executionTime.value }
      )
    } catch (err) {
      const filterError = err as Error
      error.value = filterError
      results.value = []
      totalResults.value = 0
      executionTime.value = 0

      logger.error('useBookmarkSearch', '筛选失败', filterError)
    } finally {
      isFiltering.value = false
    }
  }

  /**
   * 清空筛选结果
   */
  function clear(): void {
    query.value = ''
    results.value = []
    totalResults.value = 0
    executionTime.value = 0
    error.value = null
  }

  /**
   * 重新筛选（使用当前 query）
   */
  async function refresh(): Promise<void> {
    await filter(query.value)
  }

  // ==================== Watchers ====================
  // 自动筛选
  if (autoFilter) {
    watch(query, newQuery => {
      filter(newQuery)
    })
  }

  // ==================== Initialization ====================
  // 如果有初始查询，执行筛选
  if (initialQuery && autoFilter) {
    filter(initialQuery)
  }

  // ==================== Return ====================
  return {
    query,
    results,
    bookmarkNodes,
    isFiltering,
    error,
    totalResults,
    executionTime,
    filterSource,
    filter,
    clear,
    refresh
  }
}

// 类型声明
import type { Ref } from 'vue'
