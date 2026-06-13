/**
 * 查询服务
 *
 * 功能：
 * - 统一查询接口
 * - 多策略支持（FlexSearch、Semantic、Hybrid）
 * - 渐进式返回（Hybrid：先 FlexSearch，Semantic 补位追加）
 * - 查询缓存
 * - 结果高亮
 * - 性能监控
 * - Worker 支持
 */

import type { ILogger } from '@/core/common/logger'
import { noopLogger } from '@/core/common/logger'
import { indexedDBManager, type BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import { SearchEngine } from './engine'
import { semanticSearch } from './strategies/semantic-strategy'
import { FlexSearchStrategy } from './strategies/flexsearch-strategy'
import { mergeHybridSearchResults } from './hybrid-merge'
import { QueryCache } from './query-cache'
import { HighlightEngine } from './highlight'
import { queryWorkerAdapter } from '@/infrastructure/services/query-worker-adapter'
import type {
  SearchOptions,
  SearchStrategy,
  EnhancedSearchResult,
  SearchResponse,
  SearchResultMetadata,
  RelevanceFactors,
  IndexStatus
} from './query-types'

export class QueryService {
  private static instance: QueryService
  private queryCache: QueryCache
  private highlightEngine: HighlightEngine
  private flexSearchEngine: SearchEngine | null = null
  private flexSearchEnginePromise: Promise<SearchEngine> | null = null
  private indexStatus: IndexStatus
  private initialized: boolean = false
  private logger: ILogger

  private constructor(logger?: ILogger) {
    this.logger = logger || noopLogger
    this.queryCache = new QueryCache({
      maxSize: 1000,
      ttl: 5 * 60 * 1000,
      logger: this.logger
    })
    this.highlightEngine = new HighlightEngine()
    this.indexStatus = {
      isBuilding: false,
      isReady: false,
      lastBuilt: null,
      documentCount: 0,
      version: 1
    }
  }

  /**
   * 懒加载 FlexSearch 引擎
   *
   * Service Worker 会在启动时加载 queryService 单例，
   * 因此不能在构造函数中静态创建 FlexSearchStrategy。
   */
  private async getFlexSearchEngine(): Promise<SearchEngine> {
    if (this.flexSearchEngine) {
      return this.flexSearchEngine
    }

    if (!this.flexSearchEnginePromise) {
      this.flexSearchEnginePromise = (async () => {
        const engine = new SearchEngine(new FlexSearchStrategy())
        this.flexSearchEngine = engine
        return engine
      })().finally(() => {
        this.flexSearchEnginePromise = null
      })
    }

    return this.flexSearchEnginePromise
  }

  static getInstance(logger?: ILogger): QueryService {
    if (!QueryService.instance) {
      QueryService.instance = new QueryService(logger)
    }
    return QueryService.instance
  }

  /** 运行时注入 Logger（Application 层启动时调用） */
  useLogger(logger: ILogger): void {
    this.logger = logger
    this.queryCache.useLogger(logger)
  }

  /**
   * 初始化查询服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    this.logger.info('QueryService', '🚀 初始化查询服务...')

    try {
      // 初始化 IndexedDB
      await indexedDBManager.initialize()

      // 初始化 Worker
      await queryWorkerAdapter.initFromIDB()

      // 更新索引状态
      this.indexStatus.isReady = true
      this.indexStatus.lastBuilt = Date.now()

      this.initialized = true
      this.logger.info('QueryService', '✅ 查询服务初始化完成')
    } catch (error) {
      this.logger.error('QueryService', '❌ 初始化失败:', error)
      throw error
    }
  }

  /**
   * 规范化查询策略（仅 flexsearch / hybrid）
   */
  private normalizeStrategy(strategy: SearchStrategy | undefined): SearchStrategy {
    return strategy === 'hybrid' ? 'hybrid' : 'flexsearch'
  }

  /**
   * 检查缓存
   */
  private checkCache(
    strategy: SearchStrategy,
    query: string,
    options: SearchOptions,
    startTime: number
  ): SearchResponse | null {
    if (!options.useCache || strategy === 'hybrid') {
      this.logger.debug('QueryService', '跳过缓存检查', {
        useCache: options.useCache,
        strategy,
        reason: strategy === 'hybrid' ? 'hybrid 不缓存' : 'useCache=false'
      })
      return null
    }

    const cacheKey = `${strategy}:${query}`
    const cached = this.queryCache.get(cacheKey, options)
    if (cached) {
      this.logger.info('QueryService', `✅ 缓存命中: ${cacheKey}`, {
        cachedCount: cached.length,
        limit: options.limit,
        offset: options.offset
      })
      return {
        results: cached.slice(options.offset || 0, (options.offset || 0) + (options.limit || 100)),
        metadata: this.createMetadata(startTime, cached.length, true, strategy, query)
      }
    }

    this.logger.debug('QueryService', '缓存未命中', { cacheKey, strategy })
    return null
  }

  /**
   * 执行查询
   */
  private async executeSearch(
    strategy: SearchStrategy,
    query: string,
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    const execStart = performance.now()
    let results: EnhancedSearchResult[]

    if (strategy === 'hybrid') {
      this.logger.info('QueryService', '执行 Hybrid 检索', {
        query,
        limit: options.limit,
        minScore: options.minScore
      })
      results = await this.searchWithHybrid(query, options)
    } else {
      this.logger.info('QueryService', '执行 FlexSearch 检索', { query, limit: options.limit })
      results = await this.searchWithFlexSearch(query, options)
    }

    this.logger.info('QueryService', '策略执行完成', {
      strategy,
      query,
      resultCount: results.length,
      durationMs: Number((performance.now() - execStart).toFixed(1)),
      topResults: results.slice(0, 8).map(r => ({
        id: r.bookmark.id,
        title: r.bookmark.title,
        score: Number(r.score.toFixed(4)),
        matchedFields: r.matchedFields
      }))
    })

    return results
  }

  /**
   * 处理查询结果
   */
  private processResults(
    results: EnhancedSearchResult[],
    query: string,
    options: SearchOptions,
    strategy: SearchStrategy
  ): EnhancedSearchResult[] {
    let processed = results
    const beforeCount = processed.length

    if (options.highlight) {
      processed = this.addHighlights(processed, query)
      this.logger.debug('QueryService', '已添加高亮', { query, count: processed.length })
    }

    processed = this.sortResults(processed, options)
    this.logger.debug('QueryService', '结果已排序', {
      sortBy: options.sortBy ?? 'relevance',
      sortOrder: options.sortOrder ?? 'desc',
      beforeCount,
      afterCount: processed.length
    })

    // 缓存结果（hybrid 不缓存）
    if (options.useCache && strategy !== 'hybrid') {
      const cacheKey = `${strategy}:${query}`
      this.queryCache.set(cacheKey, processed, options)
      this.logger.debug('QueryService', '结果已写入缓存', { cacheKey, count: processed.length })
    }

    return processed
  }

  /**
   * 统一查询接口
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = performance.now()
    const { limit = 100, offset = 0, strategy } = options

    const normalizedQuery = this.normalizeQuery(query)
    const resolvedStrategy = this.normalizeStrategy(strategy)
    this.logger.info('QueryService', `🔍 查询入口`, {
      rawQuery: query,
      normalizedQuery,
      strategy: resolvedStrategy,
      options: {
        limit,
        offset,
        useCache: options.useCache,
        minScore: options.minScore,
        highlight: options.highlight
      }
    })

    if (!normalizedQuery) {
      this.logger.info('QueryService', '空查询，返回空结果')
      return this.emptyResponse(startTime, 'flexsearch')
    }

    try {
      this.logger.info('QueryService', `📌 执行策略: ${resolvedStrategy}`)

      // 检查缓存
      const cached = this.checkCache(resolvedStrategy, normalizedQuery, options, startTime)
      if (cached) {
        return cached
      }

      // 执行查询
      let results = await this.executeSearch(resolvedStrategy, normalizedQuery, options)

      // 处理结果
      results = this.processResults(results, normalizedQuery, options, resolvedStrategy)

      const duration = performance.now() - startTime
      this.logger.info(
        'QueryService',
        `✅ 完成: "${normalizedQuery}" ${duration.toFixed(1)}ms ${results.length}条 [${resolvedStrategy}]`
      )

      return {
        results: results.slice(offset, offset + limit),
        metadata: this.createMetadata(
          startTime,
          results.length,
          false,
          resolvedStrategy,
          normalizedQuery
        )
      }
    } catch (error) {
      this.logger.error('QueryService', '❌ 查询失败:', error)
      throw error
    }
  }

  /**
   * 语义搜索
   */
  private getSemanticTimeout(options: SearchOptions): number {
    return options.timeout ?? 600
  }

  /**
   * Hybrid 搜索：FlexSearch 先返回，Semantic 仅补充未命中项
   */
  private async searchWithHybrid(
    query: string,
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    const limit = options.limit || 20
    type SemanticRaw = Awaited<ReturnType<typeof semanticSearch>>

    const flexStart = performance.now()
    const flexSearchResults = await this.searchWithFlexSearch(query, {
      ...options,
      limit: limit * 2
    })
    const flexDuration = performance.now() - flexStart

    this.logger.info('QueryService', 'Hybrid FlexSearch 阶段完成', {
      query,
      flexCount: flexSearchResults.length,
      flexDurationMs: Number(flexDuration.toFixed(1)),
      flexTop: flexSearchResults.slice(0, 5).map(r => ({
        id: r.bookmark.id,
        title: r.bookmark.title,
        score: Number(r.score.toFixed(4))
      }))
    })

    const semanticTimeout = this.getSemanticTimeout(options)
    const semanticStart = performance.now()
    const semanticRaw: SemanticRaw = await Promise.race([
      semanticSearch(query, limit, options.minScore, { timeout: semanticTimeout }),
      new Promise<SemanticRaw>(resolve => setTimeout(() => resolve([]), semanticTimeout))
    ]).catch((): SemanticRaw => [])
    const semanticDuration = performance.now() - semanticStart
    const semanticTimedOut = semanticRaw.length === 0 && semanticDuration >= semanticTimeout - 10

    this.logger.info('QueryService', 'Hybrid Semantic 原始结果', {
      query,
      limit,
      minScore: options.minScore,
      timeout: semanticTimeout,
      semanticDurationMs: Number(semanticDuration.toFixed(1)),
      semanticTimedOut,
      flexCount: flexSearchResults.length,
      semanticCount: semanticRaw.length,
      semanticResults: semanticRaw.map(result => ({
        id: result.bookmark.id,
        title: result.bookmark.title,
        url: result.bookmark.url,
        score: Number(result.score.toFixed(4))
      }))
    })

    if (!semanticRaw.length) {
      this.logger.info('QueryService', 'Hybrid: Semantic 超时或无结果，仅用 FlexSearch', {
        query,
        semanticTimedOut,
        semanticDurationMs: Number(semanticDuration.toFixed(1))
      })
      return flexSearchResults
    }

    const semanticResults = semanticRaw.map(r => ({
      bookmark: r.bookmark,
      score: r.score,
      pathString: r.bookmark.pathString,
      matchedFields: ['semantic'] as string[],
      highlights: {},
      relevanceFactors: this.calculateRelevanceFactors(r.bookmark, query)
    }))

    return mergeHybridSearchResults(flexSearchResults, semanticResults)
  }

  /**
   * Hybrid 渐进式搜索
   * 立即返回 FlexSearch 结果，通过回调通知 Semantic 合并后的更新
   */
  async searchHybridProgressive(
    query: string,
    options: SearchOptions,
    onUpdate: (results: EnhancedSearchResult[]) => void
  ): Promise<EnhancedSearchResult[]> {
    const normalizedQuery = this.normalizeQuery(query)
    const limit = options.limit || 20
    const strategy = this.normalizeStrategy(options.strategy)

    this.logger.info('QueryService', '渐进式 Hybrid 检索入口', {
      rawQuery: query,
      normalizedQuery,
      strategy,
      limit
    })

    if (strategy === 'flexsearch') {
      const flexSearchOnly = await this.searchWithFlexSearch(normalizedQuery, { ...options, limit })
      const highlighted =
        options.highlight !== false
          ? this.addHighlights(flexSearchOnly, normalizedQuery)
          : flexSearchOnly
      this.logger.info('QueryService', '渐进式：仅 FlexSearch', {
        query: normalizedQuery,
        count: highlighted.length
      })
      return highlighted.slice(0, limit)
    }

    // 立即返回 FlexSearch 结果
    const flexSearchResults = await this.searchWithFlexSearch(normalizedQuery, {
      ...options,
      limit: limit * 2
    })
    const highlighted =
      options.highlight !== false
        ? this.addHighlights(flexSearchResults, normalizedQuery)
        : flexSearchResults

    this.logger.info('QueryService', '渐进式：FlexSearch 首屏返回', {
      query: normalizedQuery,
      flexCount: highlighted.length,
      returning: Math.min(highlighted.length, limit)
    })

    const semanticTimeout = this.getSemanticTimeout(options)

    // 异步执行 Semantic，完成后通知更新
    semanticSearch(normalizedQuery, limit, options.minScore, { timeout: semanticTimeout })
      .then(semanticRaw => {
        if (!semanticRaw.length) {
          this.logger.info('QueryService', '渐进式：Semantic 无结果，跳过更新', {
            query: normalizedQuery
          })
          return
        }
        const semanticResults = semanticRaw.map(r => ({
          bookmark: r.bookmark,
          score: r.score,
          pathString: r.bookmark.pathString,
          matchedFields: ['semantic'] as string[],
          highlights: {},
          relevanceFactors: this.calculateRelevanceFactors(r.bookmark, normalizedQuery)
        }))
        const merged = mergeHybridSearchResults(flexSearchResults, semanticResults)
        const mergedHighlighted =
          options.highlight !== false ? this.addHighlights(merged, normalizedQuery) : merged
        this.logger.info('QueryService', '渐进式：Semantic 合并后回调更新', {
          query: normalizedQuery,
          semanticCount: semanticRaw.length,
          mergedCount: mergedHighlighted.length
        })
        onUpdate(mergedHighlighted)
      })
      .catch(error => {
        this.logger.warn('QueryService', '渐进式：Semantic 失败', { query: normalizedQuery, error })
      })

    return highlighted.slice(0, limit)
  }

  /**
   * FlexSearch 查询
   */
  private async searchWithFlexSearch(
    query: string,
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    const limit = options.limit || 100
    const flexStart = performance.now()

    try {
      this.logger.debug('QueryService', 'FlexSearch → Worker/Offscreen', { query, limit })
      const workerResults = await queryWorkerAdapter.search(query, limit)
      const enhanced = this.convertToEnhanced(workerResults, query)
      this.logger.info('QueryService', 'FlexSearch Worker 命中', {
        query,
        limit,
        hitCount: enhanced.length,
        durationMs: Number((performance.now() - flexStart).toFixed(1)),
        topHits: enhanced.slice(0, 5).map(r => ({
          id: r.bookmark.id,
          title: r.bookmark.title,
          score: Number(r.score.toFixed(4))
        }))
      })
      return enhanced
    } catch (workerError) {
      this.logger.warn('QueryService', 'Worker 查询失败，降级到主线程', {
        query,
        error: workerError
      })
      const bookmarks = await indexedDBManager.getAllBookmarks()
      const flexSearchEngine = await this.getFlexSearchEngine()
      const results = flexSearchEngine.search(query, bookmarks)
      const enhanced = this.convertToEnhanced(results, query)
      this.logger.info('QueryService', 'FlexSearch 主线程降级命中', {
        query,
        bookmarkPoolSize: bookmarks.length,
        hitCount: enhanced.length,
        durationMs: Number((performance.now() - flexStart).toFixed(1))
      })
      return enhanced
    }
  }

  /**
   * Native 查询（Chrome API）
   */
  private normalizeQuery(query: string): string {
    return String(query || '')
      .trim()
      .toLowerCase()
  }

  /**
   * 选择查询策略
   */
  /**
   * 转换为增强结果
   */
  private convertToEnhanced(
    results: Array<{ bookmark: BookmarkRecord; score: number }>,
    query: string
  ): EnhancedSearchResult[] {
    return results.map(result => ({
      bookmark: result.bookmark,
      score: result.score,
      pathString: result.bookmark.pathString,
      matchedFields: this.detectMatchedFields(result.bookmark, query),
      highlights: {},
      relevanceFactors: this.calculateRelevanceFactors(result.bookmark, query)
    }))
  }

  /**
   * 检测匹配字段
   */
  private detectMatchedFields(bookmark: BookmarkRecord, query: string): string[] {
    const fields: string[] = []
    const lowerQuery = query.toLowerCase()

    if (bookmark.titleLower.includes(lowerQuery)) {
      fields.push('title')
    }
    if (bookmark.urlLower?.includes(lowerQuery)) {
      fields.push('url')
    }
    if (bookmark.domain?.toLowerCase().includes(lowerQuery)) {
      fields.push('domain')
    }

    return fields
  }

  /**
   * 计算相关性因素
   */
  private calculateRelevanceFactors(bookmark: BookmarkRecord, query: string): RelevanceFactors {
    const lowerQuery = query.toLowerCase()

    return {
      titleMatch: bookmark.titleLower.includes(lowerQuery) ? 1.0 : 0.0,
      urlMatch: bookmark.urlLower?.includes(lowerQuery) ? 0.8 : 0.0,
      domainMatch: bookmark.domain?.toLowerCase().includes(lowerQuery) ? 0.6 : 0.0,
      keywordMatch: 0.0, // TODO: 实现关键词匹配
      exactMatch: bookmark.titleLower === lowerQuery ? 1.0 : 0.0,
      recencyBoost: 0.0, // TODO: 实现最近使用加分
      clickBoost: 0.0 // TODO: 实现点击频率加分
    }
  }

  /**
   * 添加高亮
   */
  private addHighlights(results: EnhancedSearchResult[], query: string): EnhancedSearchResult[] {
    return results.map(result => ({
      ...result,
      highlights: {
        title: this.highlightEngine.highlight(result.bookmark.title, query),
        url: result.bookmark.url ? this.highlightEngine.highlight(result.bookmark.url, query) : []
      }
    }))
  }

  /**
   * 排序结果
   */
  private sortResults(
    results: EnhancedSearchResult[],
    options: SearchOptions
  ): EnhancedSearchResult[] {
    const { sortBy = 'relevance', sortOrder = 'desc' } = options

    results.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'relevance':
          comparison = b.score - a.score
          break
        case 'title':
          comparison = a.bookmark.title.localeCompare(b.bookmark.title)
          break
        case 'date':
          comparison = (b.bookmark.dateAdded || 0) - (a.bookmark.dateAdded || 0)
          break
        default:
          comparison = b.score - a.score
      }

      return sortOrder === 'asc' ? -comparison : comparison
    })

    return results
  }

  /**
   * 创建元数据
   */
  private createMetadata(
    startTime: number,
    totalResults: number,
    cacheHit: boolean,
    strategy: string,
    queryNormalized: string
  ): SearchResultMetadata {
    return {
      searchTime: performance.now() - startTime,
      totalResults,
      cacheHit,
      strategy,
      queryNormalized
    }
  }

  /**
   * 空响应
   */
  private emptyResponse(startTime: number, strategy: string): SearchResponse {
    return {
      results: [],
      metadata: this.createMetadata(startTime, 0, false, strategy, '')
    }
  }

  /**
   * 失效缓存
   */
  invalidateCache(pattern?: string): void {
    this.queryCache.invalidate(pattern)
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.queryCache.clear()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.queryCache.getStats()
  }

  /**
   * 获取索引状态
   */
  getIndexStatus(): IndexStatus {
    return { ...this.indexStatus }
  }
}

// 导出单例
export const queryService = QueryService.getInstance()

// 默认导出
export default queryService
