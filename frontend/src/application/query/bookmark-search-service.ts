/**
 * 书签搜索服务（Application 层）
 *
 * 唯一检索入口：Chrome 书签 → IndexedDB → 统一结果管道 → 各 UI 入口。
 * 所有入口必须调用本服务；禁止在 UI / Composable 层重复过滤或兜底。
 *
 * @module application/query/bookmark-search-service
 */

import { queryService, type SearchResponse, type EnhancedSearchResult } from '@/core/query-engine'
import {
  resolveEffectiveSearchStrategy,
  readSearchModeSnapshotFromStorage
} from '@/core/query/search-mode'
import type { SearchOptions, SearchStrategy } from '@/types/domain/query'
import { logger } from '@/infrastructure/logging/logger'
import { adaptInfrastructureLogger } from '@/infrastructure/logging/core-logger-adapter'
import { ok, err, type Result } from '@/core/common/result'
import { getPerformanceMonitor as importPerformanceMonitor } from '@/infrastructure/services/query-performance-monitor'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { SEMANTIC_VECTOR_MIN_SCORE } from '@/application/query/search-result-filter'
import { finalizeBookmarkSearchResults } from '@/application/query/unified-search-pipeline'

const getPerformanceMonitor = async () => {
  if (typeof document === 'undefined') {
    return null
  }
  return importPerformanceMonitor()
}

/** 各入口共享的检索默认项（limit 由调用方按场景覆盖） */
const UNIFIED_SEARCH_DEFAULTS: SearchOptions = {
  useCache: true,
  highlight: false,
  minScore: SEMANTIC_VECTOR_MIN_SCORE
}

const LOG_TAG = 'BookmarkSearchService'

/** 注入 Core 层 QueryService 日志，确保检索链路日志可见 */
queryService.useLogger(adaptInfrastructureLogger())

function formatResultBrief(result: EnhancedSearchResult) {
  return {
    id: result.bookmark.id,
    title: result.bookmark.title,
    url: result.bookmark.url,
    score: Number(result.score.toFixed(4)),
    matchedFields: result.matchedFields ?? [],
    pathString: result.bookmark.pathString
  }
}

export class BookmarkSearchService {
  private performanceMonitor: Awaited<ReturnType<typeof getPerformanceMonitor>> | null = null
  private initialized = false

  private async getPerformanceMonitorInstance() {
    if (!this.performanceMonitor) {
      this.performanceMonitor = await getPerformanceMonitor()
    }
    return this.performanceMonitor
  }

  async initialize(): Promise<void> {
    await queryService.initialize()
    this.initialized = true
    logger.info('BookmarkSearchService', '✅ 搜索服务初始化完成')
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.initialize()
  }

  /** 合并用户选项与当前账号解析出的检索策略 */
  private async withResolvedStrategy(options?: SearchOptions): Promise<SearchOptions> {
    const snapshot = await readSearchModeSnapshotFromStorage()
    const strategy = await resolveEffectiveSearchStrategy()
    const resolvedOptions = { ...UNIFIED_SEARCH_DEFAULTS, ...options, strategy }
    logger.info(LOG_TAG, '解析检索策略', {
      snapshot,
      strategy,
      requestedStrategy: options?.strategy,
      limit: resolvedOptions.limit,
      minScore: resolvedOptions.minScore,
      useCache: resolvedOptions.useCache,
      reason:
        strategy === 'hybrid'
          ? '已登录 + Pro + 语义开关开启'
          : !snapshot.isLoggedIn
            ? '未登录'
            : !snapshot.isPro
              ? '非 Pro'
              : '语义开关关闭'
    })
    return resolvedOptions
  }

  /**
   * 统一结果管道：相关性过滤 + IndexedDB 子串兜底
   */
  private async finalizeResults(
    query: string,
    response: SearchResponse,
    limit: number
  ): Promise<EnhancedSearchResult[]> {
    const strategy = (response.metadata.strategy ?? 'flexsearch') as SearchStrategy

    return finalizeBookmarkSearchResults(
      query,
      response.results,
      strategy,
      limit,
      async (trimmedQuery, fallbackLimit) =>
        indexedDBManager.searchBookmarks(trimmedQuery, {
          query: trimmedQuery,
          limit: fallbackLimit,
          includeDomain: true,
          includeUrl: true,
          includeKeywords: true,
          includeTags: true
        })
    )
  }

  async search(query: string, options?: SearchOptions): Promise<Result<EnhancedSearchResult[]>> {
    const metadataResult = await this.searchWithMetadata(query, options)
    if (!metadataResult.ok) {
      return metadataResult
    }
    return ok(metadataResult.value.results)
  }

  /**
   * 渐进式检索：FlexSearch 先返回；Pro 语义开启时 Semantic 完成后回调 onUpdate
   */
  async searchHybridProgressive(
    query: string,
    options: SearchOptions | undefined,
    onUpdate: (results: EnhancedSearchResult[]) => void
  ): Promise<EnhancedSearchResult[]> {
    await this.ensureInitialized()
    const resolvedOptions = await this.withResolvedStrategy(options)
    return queryService.searchHybridProgressive(query, resolvedOptions, onUpdate)
  }

  async searchWithMetadata(
    query: string,
    options?: SearchOptions
  ): Promise<Result<SearchResponse>> {
    const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const startTime = performance.now()
    await this.ensureInitialized()

    logger.info(LOG_TAG, '▶ 检索入口', {
      traceId,
      query,
      options: {
        limit: options?.limit,
        strategy: options?.strategy,
        useCache: options?.useCache,
        highlight: options?.highlight,
        minScore: options?.minScore,
        sortBy: options?.sortBy,
        sortOrder: options?.sortOrder
      }
    })

    try {
      const resolvedOptions = await this.withResolvedStrategy(options)
      const limit = resolvedOptions.limit ?? 100
      const queryStart = performance.now()
      const rawResponse = await queryService.search(query, resolvedOptions)
      const queryDuration = performance.now() - queryStart

      logger.info(LOG_TAG, '原始检索结果', {
        traceId,
        query,
        strategy: rawResponse.metadata.strategy,
        cacheHit: rawResponse.metadata.cacheHit,
        searchTimeMs: Number(rawResponse.metadata.searchTime.toFixed(1)),
        queryDurationMs: Number(queryDuration.toFixed(1)),
        rawCount: rawResponse.results.length,
        rawResults: rawResponse.results.slice(0, 12).map(formatResultBrief)
      })

      const finalizeStart = performance.now()
      const results = await this.finalizeResults(query, rawResponse, limit)
      const finalizeDuration = performance.now() - finalizeStart

      logger.info(LOG_TAG, '最终检索结果', {
        traceId,
        query,
        strategy: rawResponse.metadata.strategy,
        finalCount: results.length,
        finalizeDurationMs: Number(finalizeDuration.toFixed(1)),
        totalDurationMs: Number((performance.now() - startTime).toFixed(1)),
        finalResults: results.slice(0, 12).map(formatResultBrief)
      })
      const response: SearchResponse = {
        results,
        metadata: {
          ...rawResponse.metadata,
          totalResults: results.length
        }
      }
      void this.recordPerformance(query, startTime, response, true)
      return ok(response)
    } catch (error) {
      const errorObj = error as Error
      void this.recordPerformance(query, startTime, null, false, errorObj)
      logger.error(LOG_TAG, '搜索失败', { traceId, query, error: errorObj })
      return err(errorObj)
    }
  }

  private async recordPerformance(
    query: string,
    startTime: number,
    response: SearchResponse | null,
    success: boolean,
    error?: Error
  ): Promise<void> {
    const duration = performance.now() - startTime
    const monitor = await this.getPerformanceMonitorInstance()
    if (monitor) {
      monitor.recordSearch({
        query,
        duration,
        resultCount: response?.results.length || 0,
        cacheHit: response?.metadata.cacheHit || false,
        searchMode: response?.metadata.strategy || 'unknown',
        sources: response?.metadata.strategy ? [response.metadata.strategy] : [],
        success,
        ...(error?.message ? { errorMessage: error.message } : {})
      })
    }
  }

  invalidateCache(pattern?: string): void {
    queryService.invalidateCache(pattern)
    logger.info('BookmarkSearchService', `✅ 缓存已失效${pattern ? `: ${pattern}` : ''}`)
  }

  clearCache(): void {
    queryService.clearCache()
    logger.info('BookmarkSearchService', '✅ 缓存已清空')
  }

  getCacheStats() {
    return queryService.getCacheStats()
  }

  getIndexStatus() {
    return queryService.getIndexStatus()
  }

  async getPerformanceStats() {
    const monitor = await this.getPerformanceMonitorInstance()
    return monitor?.getPerformanceStats() || null
  }

  async getOptimizationSuggestions() {
    const monitor = await this.getPerformanceMonitorInstance()
    return monitor?.getOptimizationSuggestions() || []
  }
}

export const bookmarkSearchService = new BookmarkSearchService()

export default bookmarkSearchService
