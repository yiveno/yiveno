/**
 * 书签搜索服务（Application 层）
 *
 * 统一检索入口：根据 Pro + 语义开关自动选择 fuse 或 hybrid。
 *
 * @module application/query/bookmark-search-service
 */

import { queryService, type SearchResponse, type EnhancedSearchResult } from '@/core/query-engine'
import { resolveEffectiveSearchStrategy } from '@/core/query/search-mode'
import type { SearchOptions } from '@/types/domain/query'
import { logger } from '@/infrastructure/logging/logger'
import { ok, err, type Result } from '@/core/common/result'
import { getPerformanceMonitor as importPerformanceMonitor } from '@/services/query-performance-monitor'

const getPerformanceMonitor = async () => {
  if (typeof document === 'undefined') {
    return null
  }
  return importPerformanceMonitor()
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
    const strategy = await resolveEffectiveSearchStrategy()
    return { ...options, strategy }
  }

  async search(query: string, options?: SearchOptions): Promise<Result<EnhancedSearchResult[]>> {
    const startTime = performance.now()
    await this.ensureInitialized()

    try {
      const resolvedOptions = await this.withResolvedStrategy(options)
      const response = await queryService.search(query, resolvedOptions)
      void this.recordPerformance(query, startTime, response, true)
      return ok(response.results)
    } catch (error) {
      const errorObj = error as Error
      void this.recordPerformance(query, startTime, null, false, errorObj)
      logger.error('BookmarkSearchService', '搜索失败', { query, error: errorObj })
      return err(errorObj)
    }
  }

  /**
   * 渐进式检索：Fuse 先返回；Pro 语义开启时 Semantic 完成后回调 onUpdate
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
    const startTime = performance.now()
    await this.ensureInitialized()

    try {
      const resolvedOptions = await this.withResolvedStrategy(options)
      const response = await queryService.search(query, resolvedOptions)
      void this.recordPerformance(query, startTime, response, true)
      return ok(response)
    } catch (error) {
      const errorObj = error as Error
      void this.recordPerformance(query, startTime, null, false, errorObj)
      logger.error('BookmarkSearchService', '搜索失败', { query, error: errorObj })
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
