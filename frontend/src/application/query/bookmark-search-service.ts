/**
 * 书签搜索服务（Application 层）
 *
 * 应用层统一搜索入口，封装 core/query-engine 的 queryService。
 * 支持多种搜索策略：fuse / semantic / hybrid / auto
 *
 * 职责：
 * - 封装底层 queryService，提供简洁的应用层接口
 * - 集成错误处理与性能监控
 * - 作为全局唯一的 IndexedDB 搜索入口
 *
 * @module application/query/bookmark-search-service
 */

import { queryService, type SearchResponse, type EnhancedSearchResult } from '@/core/query-engine'
import type { SearchOptions } from '@/types/domain/query'
import { logger } from '@/infrastructure/logging/logger'
import { ok, err, type Result } from '@/core/common/result'
import { getPerformanceMonitor as importPerformanceMonitor } from '@/services/query-performance-monitor'

// 动态导入性能监控，避免在 Service Worker 中加载不必要的依赖
const getPerformanceMonitor = async () => {
  if (typeof document === 'undefined') {
    return null
  }
  return importPerformanceMonitor()
}

/**
 * 书签搜索服务类
 *
 * 全局唯一的 IndexedDB 书签搜索入口
 */
export class BookmarkSearchService {
  private performanceMonitor: Awaited<ReturnType<typeof getPerformanceMonitor>> | null = null
  private initialized = false

  /** 获取性能监控器（延迟初始化） */
  private async getPerformanceMonitorInstance() {
    if (!this.performanceMonitor) {
      this.performanceMonitor = await getPerformanceMonitor()
    }
    return this.performanceMonitor
  }

  /** 初始化搜索服务 */
  async initialize(): Promise<void> {
    await queryService.initialize()
    this.initialized = true
    logger.info('BookmarkSearchService', '✅ 搜索服务初始化完成')
  }

  /** 确保服务已初始化 */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.initialize()
  }

  /**
   * 搜索书签（返回结果列表）
   *
   * @param query - 搜索关键词
   * @param options - 搜索选项（strategy / limit / highlight 等）
   * @returns Result 包装的搜索结果数组
   */
  async search(query: string, options?: SearchOptions): Promise<Result<EnhancedSearchResult[]>> {
    const startTime = performance.now()
    await this.ensureInitialized()

    try {
      const response = await queryService.search(query, options)
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
   * 搜索书签（返回完整响应，包含元数据）
   *
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns Result 包装的完整搜索响应（结果 + 元数据）
   */
  async searchWithMetadata(
    query: string,
    options?: SearchOptions
  ): Promise<Result<SearchResponse>> {
    const startTime = performance.now()
    await this.ensureInitialized()

    try {
      const response = await queryService.search(query, options)
      void this.recordPerformance(query, startTime, response, true)
      return ok(response)
    } catch (error) {
      const errorObj = error as Error
      void this.recordPerformance(query, startTime, null, false, errorObj)
      logger.error('BookmarkSearchService', '搜索失败', { query, error: errorObj })
      return err(errorObj)
    }
  }

  /** 记录性能指标（内部方法） */
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

  /** 使缓存失效 */
  invalidateCache(pattern?: string): void {
    queryService.invalidateCache(pattern)
    logger.info('BookmarkSearchService', `✅ 缓存已失效${pattern ? `: ${pattern}` : ''}`)
  }

  /** 清空所有缓存 */
  clearCache(): void {
    queryService.clearCache()
    logger.info('BookmarkSearchService', '✅ 缓存已清空')
  }

  /** 获取缓存统计信息 */
  getCacheStats() {
    return queryService.getCacheStats()
  }

  /** 获取索引状态 */
  getIndexStatus() {
    return queryService.getIndexStatus()
  }

  /** 获取性能统计 */
  async getPerformanceStats() {
    const monitor = await this.getPerformanceMonitorInstance()
    return monitor?.getPerformanceStats() || null
  }

  /** 获取优化建议 */
  async getOptimizationSuggestions() {
    const monitor = await this.getPerformanceMonitorInstance()
    return monitor?.getOptimizationSuggestions() || []
  }
}

/** 全局唯一书签搜索服务实例 */
export const bookmarkSearchService = new BookmarkSearchService()

// 默认导出
export default bookmarkSearchService
