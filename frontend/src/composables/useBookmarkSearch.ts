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

import { ref, computed, watch, toValue } from 'vue'
import type { MaybeRef } from 'vue'
import { bookmarkMemorySearchService } from '@/application/query/bookmark-memory-search-service'
import type {
  FilteredBookmarkNode,
  BookmarkFilterOptions
} from '@/application/query/bookmark-memory-search-service'
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import type { BookmarkNode } from '@/types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types/bookmark-record'
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
  mode?: MaybeRef<'indexeddb' | 'memory'>

  /**
   * 内存数据源
   * - mode='memory' 时使用
   * - 可以是 Ref、ComputedRef 或普通数组
   */
  data?: MaybeRef<BookmarkNode[]>

  /** 筛选结果数量限制 */
  limit?: MaybeRef<number>

  /** 是否自动筛选（当 query 变化时） */
  autoFilter?: boolean

  /** 初始筛选条件 */
  initialQuery?: MaybeRef<string>

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
export function useBookmarkSearch(options: UseBookmarkSearchOptions = {}): UseBookmarkSearchReturn {
  const { autoFilter = true, filterOptions = {} } = options

  const modeRef = computed(() => toValue(options.mode ?? 'indexeddb'))
  const limitRef = computed(() => toValue(options.limit ?? 100))
  const initialQueryRef = computed(() => toValue(options.initialQuery ?? ''))
  const dataRef = computed((): BookmarkNode[] => toValue(options.data ?? []))

  // ==================== State ====================
  const query = ref(initialQueryRef.value)
  const results = ref<FilteredBookmarkNode[]>([])
  const isFiltering = ref(false)
  const error = ref<Error | null>(null)
  const totalResults = ref(0)
  const executionTime = ref(0)
  const filterSource = ref<'indexeddb' | 'memory'>(modeRef.value)

  watch(initialQueryRef, newQuery => {
    if (newQuery !== query.value) {
      query.value = newQuery
    }
  })

  watch(modeRef, newMode => {
    filterSource.value = newMode
  })

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
   * 构建 FilteredBookmarkNode 的路径字段
   */
  function buildPathFields(node: FilteredBookmarkNode, bookmark: BookmarkRecord): void {
    node.path = bookmark.path || []
    node.pathString = bookmark.pathString || ''
    node.pathIds = bookmark.pathIds || []
    node.ancestorIds = bookmark.ancestorIds || []
    node.depth = bookmark.depth || 0
  }

  /**
   * 构建 FilteredBookmarkNode 的搜索字段
   */
  function buildSearchFields(node: FilteredBookmarkNode, bookmark: BookmarkRecord): void {
    node.titleLower = bookmark.titleLower || bookmark.title?.toLowerCase() || ''
    node.urlLower = bookmark.urlLower || bookmark.url?.toLowerCase()
    node.domain = bookmark.domain
    node.keywords = bookmark.keywords || []
  }

  /**
   * 构建 FilteredBookmarkNode 的文件夹字段
   */
  function buildFolderFields(node: FilteredBookmarkNode, bookmark: BookmarkRecord): void {
    node.isFolder = !bookmark.url
    node.childrenCount = bookmark.childrenCount || 0
  }

  /**
   * 映射 IndexedDB 搜索结果为 FilteredBookmarkNode
   */
  function mapIndexedDBResultsToNodes(
    searchResults: Array<{ bookmark: BookmarkRecord; score: number; matchedFields?: string[] }>
  ): FilteredBookmarkNode[] {
    return searchResults.map((r): FilteredBookmarkNode => {
      const bookmark = r.bookmark
      const node: FilteredBookmarkNode = {
        id: bookmark.id,
        title: bookmark.title || '无标题',
        url: bookmark.url,
        dateAdded: bookmark.dateAdded || 0,
        dateGroupModified: bookmark.dateGroupModified,
        parentId: bookmark.parentId,
        index: bookmark.index || 0,
        children: !bookmark.url ? [] : undefined,
        filterScore: r.score,
        matchedFields: r.matchedFields ?? []
      } as FilteredBookmarkNode

      buildPathFields(node, bookmark)
      buildSearchFields(node, bookmark)
      buildFolderFields(node, bookmark)

      return node
    })
  }

  /**
   * 执行内存模式筛选
   */
  async function filterMemoryMode(trimmedQuery: string): Promise<void> {
    const result = bookmarkMemorySearchService.search(dataRef.value, trimmedQuery, {
      limit: limitRef.value,
      ...filterOptions
    })
    results.value = result.nodes
    totalResults.value = result.total
    executionTime.value = result.executionTime
    filterSource.value = 'memory'
  }

  /**
   * 执行 IndexedDB 模式筛选
   */
  async function filterIndexedDBMode(trimmedQuery: string): Promise<void> {
    const result = await bookmarkSearchService.searchWithMetadata(trimmedQuery, {
      limit: limitRef.value,
      highlight: true,
      filterFolders: filterOptions.filterFolders,
      fuzzyThreshold: filterOptions.threshold
    })

    if (!result.ok) {
      throw result.error
    }

    const response = result.value
    const nodes = mapIndexedDBResultsToNodes(response.results)

    results.value = nodes
    totalResults.value = response.results.length
    executionTime.value = Math.round(response.metadata.searchTime)
    filterSource.value = 'indexeddb'
  }

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
    if (modeRef.value === 'memory' && dataRef.value.length === 0) {
      logger.warn('useBookmarkSearch', '内存模式下未提供数据源，跳过筛选')
      clear()
      return
    }

    isFiltering.value = true
    error.value = null

    logger.info('useBookmarkSearch', '▶ UI 筛选入口', {
      query: trimmedQuery,
      mode: modeRef.value,
      limit: limitRef.value,
      filterOptions
    })

    try {
      if (modeRef.value === 'memory') {
        await filterMemoryMode(trimmedQuery)
      } else {
        await filterIndexedDBMode(trimmedQuery)
      }

      logger.info('useBookmarkSearch', `筛选完成 (${filterSource.value}): "${trimmedQuery}"`, {
        total: totalResults.value,
        executionTime: executionTime.value,
        strategy: modeRef.value === 'indexeddb' ? 'via-bookmarkSearchService' : 'memory',
        topResults: results.value.slice(0, 5).map(n => ({
          id: n.id,
          title: n.title,
          score: n.filterScore,
          matchedFields: n.matchedFields
        }))
      })
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
      void filter(newQuery)
    })
  }

  // ==================== Initialization ====================
  // 如果有初始查询，执行筛选
  if (initialQueryRef.value && autoFilter) {
    void filter(initialQueryRef.value)
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
