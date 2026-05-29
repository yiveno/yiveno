/**
 * 查询服务
 *
 * 功能：
 * - 统一查询接口
 * - 多策略支持（Fuse、Semantic、Hybrid、Auto）
 * - 查询意图自动识别
 * - 渐进式返回（Hybrid 模式先返回 Fuse 结果，Semantic 异步合并）
 * - 查询缓存
 * - 结果高亮
 * - 性能监控
 * - Worker 支持
 */

import type { ILogger } from "@/core/common/logger";
import { noopLogger } from "@/core/common/logger";
import {
  indexedDBManager,
  type BookmarkRecord,
} from "@/infrastructure/indexeddb/manager";
import { SearchEngine } from "./engine";
import { semanticSearch } from "./strategies/semantic-strategy";
import { detectIntent } from "./intent-detector";
import { FlexSearchStrategy } from "./strategies/flexsearch-strategy";
import { QueryCache } from "./query-cache";
import { HighlightEngine } from "./highlight";
import { queryWorkerAdapter } from "@/services/query-worker-adapter";
import type {
  SearchOptions,
  SearchStrategy,
  EnhancedSearchResult,
  SearchResponse,
  SearchResultMetadata,
  RelevanceFactors,
  IndexStatus,
} from "./query-types";

export class QueryService {
  private static instance: QueryService;
  private queryCache: QueryCache;
  private highlightEngine: HighlightEngine;
  private fuseEngine: SearchEngine | null = null;
  private fuseEnginePromise: Promise<SearchEngine> | null = null;
  private indexStatus: IndexStatus;
  private initialized: boolean = false;
  private logger: ILogger;

  private constructor(logger?: ILogger) {
    this.logger = logger || noopLogger;
    this.queryCache = new QueryCache({
      maxSize: 1000,
      ttl: 5 * 60 * 1000,
      logger: this.logger,
    });
    this.highlightEngine = new HighlightEngine();
    this.indexStatus = {
      isBuilding: false,
      isReady: false,
      lastBuilt: null,
      documentCount: 0,
      version: 1,
    };
  }

  /**
   * 懒加载 FlexSearch 引擎
   *
   * Service Worker 会在启动时加载 queryService 单例，
   * 因此不能在构造函数中静态创建 FlexSearchStrategy。
   */
  private async getFuseEngine(): Promise<SearchEngine> {
    if (this.fuseEngine) {
      return this.fuseEngine;
    }

    if (!this.fuseEnginePromise) {
      this.fuseEnginePromise = (async () => {
        const engine = new SearchEngine(new FlexSearchStrategy());
        this.fuseEngine = engine;
        return engine;
      })().finally(() => {
        this.fuseEnginePromise = null;
      });
    }

    return this.fuseEnginePromise;
  }

  static getInstance(logger?: ILogger): QueryService {
    if (!QueryService.instance) {
      QueryService.instance = new QueryService(logger);
    }
    return QueryService.instance;
  }

  /**
   * 初始化查询服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.info("QueryService", "🚀 初始化查询服务...");

    try {
      // 初始化 IndexedDB
      await indexedDBManager.initialize();

      // 初始化 Worker
      await queryWorkerAdapter.initFromIDB();

      // 更新索引状态
      this.indexStatus.isReady = true;
      this.indexStatus.lastBuilt = Date.now();

      this.initialized = true;
      this.logger.info("QueryService", "✅ 查询服务初始化完成");
    } catch (error) {
      this.logger.error("QueryService", "❌ 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 解析查询策略
   */
  private async resolveStrategy(
    strategy: SearchStrategy,
    query: string,
  ): Promise<SearchStrategy> {
    const resolvedStrategy =
      strategy === "auto" ? detectIntent(query).intent : strategy;
    return resolvedStrategy;
  }

  /**
   * 检查缓存
   */
  private checkCache(
    strategy: SearchStrategy,
    query: string,
    options: SearchOptions,
    startTime: number,
  ): SearchResponse | null {
    if (!options.useCache || strategy === "hybrid") {
      return null;
    }

    const cacheKey = `${strategy}:${query}`;
    const cached = this.queryCache.get(cacheKey, options);
    if (cached) {
      this.logger.info("QueryService", `✅ 缓存命中: ${cacheKey}`);
      return {
        results: cached.slice(
          options.offset || 0,
          (options.offset || 0) + (options.limit || 100),
        ),
        metadata: this.createMetadata(
          startTime,
          cached.length,
          true,
          strategy,
          query,
        ),
      };
    }

    return null;
  }

  /**
   * 执行查询
   */
  private async executeSearch(
    strategy: SearchStrategy,
    query: string,
    options: SearchOptions,
  ): Promise<EnhancedSearchResult[]> {
    let results: EnhancedSearchResult[];

    if (strategy === "semantic") {
      results = await this.searchWithSemantic(query, options);
    } else if (strategy === "hybrid") {
      results = await this.searchWithHybrid(query, options);
    } else {
      results = await this.searchWithFuse(query, options);
    }

    return results;
  }

  /**
   * 处理查询结果
   */
  private processResults(
    results: EnhancedSearchResult[],
    query: string,
    options: SearchOptions,
    strategy: SearchStrategy,
  ): EnhancedSearchResult[] {
    let processed = results;

    if (options.highlight) {
      processed = this.addHighlights(processed, query);
    }

    processed = this.sortResults(processed, options);

    // 缓存结果（hybrid 不缓存）
    if (options.useCache && strategy !== "hybrid") {
      const cacheKey = `${strategy}:${query}`;
      this.queryCache.set(cacheKey, processed, options);
    }

    return processed;
  }

  /**
   * 统一查询接口
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResponse> {
    const startTime = performance.now();
    const {
      limit = 100,
      offset = 0,
      timeout: _timeout = 5000,
      strategy = "auto",
    } = options;

    const normalizedQuery = this.normalizeQuery(query);
    this.logger.info(
      "QueryService",
      `🔍 查询: "${normalizedQuery}" strategy=${strategy}`,
    );

    if (!normalizedQuery) {
      return this.emptyResponse(startTime, "fuse");
    }

    try {
      // 解析策略
      const resolvedStrategy = await this.resolveStrategy(
        strategy,
        normalizedQuery,
      );
      this.logger.info("QueryService", `📌 执行策略: ${resolvedStrategy}`);

      // 检查缓存
      const cached = this.checkCache(
        resolvedStrategy,
        normalizedQuery,
        options,
        startTime,
      );
      if (cached) {
        return cached;
      }

      // 执行查询
      let results = await this.executeSearch(
        resolvedStrategy,
        normalizedQuery,
        options,
      );

      // 处理结果
      results = this.processResults(
        results,
        normalizedQuery,
        options,
        resolvedStrategy,
      );

      const duration = performance.now() - startTime;
      this.logger.info(
        "QueryService",
        `✅ 完成: "${normalizedQuery}" ${duration.toFixed(1)}ms ${results.length}条 [${resolvedStrategy}]`,
      );

      return {
        results: results.slice(offset, offset + limit),
        metadata: this.createMetadata(
          startTime,
          results.length,
          false,
          resolvedStrategy,
          normalizedQuery,
        ),
      };
    } catch (error) {
      this.logger.error("QueryService", "❌ 查询失败:", error);
      throw error;
    }
  }

  /**
   * 语义搜索
   */
  private async searchWithSemantic(
    query: string,
    options: SearchOptions,
  ): Promise<EnhancedSearchResult[]> {
    const topK = options.limit || 20;
    const semanticResults = await semanticSearch(query, topK);
    return semanticResults.map((r) => ({
      bookmark: r.bookmark,
      score: r.score,
      pathString: r.bookmark.pathString,
      matchedFields: ["semantic"],
      highlights: {},
      relevanceFactors: this.calculateRelevanceFactors(
        r.bookmark,
        query,
        r.score,
      ),
    }));
  }

  /**
   * Hybrid 搜索：Fuse 立即返回，Semantic 异步合并
   * 加入超时保护：600ms 内 Semantic 未返回则只用 Fuse 结果
   */
  private async searchWithHybrid(
    query: string,
    options: SearchOptions,
  ): Promise<EnhancedSearchResult[]> {
    const limit = options.limit || 20;
    type SemanticRaw = Awaited<ReturnType<typeof semanticSearch>>;

    const fusePromise = this.searchWithFuse(query, {
      ...options,
      limit: limit * 2,
    });

    // Semantic 加超时保护，600ms 内未返回则降级到空数组
    const semanticPromise: Promise<SemanticRaw> = Promise.race([
      semanticSearch(query, limit),
      new Promise<SemanticRaw>((resolve) => setTimeout(() => resolve([]), 600)),
    ]).catch((): SemanticRaw => []);

    const [fuseResults, semanticRaw] = await Promise.all([
      fusePromise,
      semanticPromise,
    ]);

    if (!semanticRaw.length) {
      this.logger.info(
        "QueryService",
        "Hybrid: Semantic 超时或无结果，仅用 Fuse",
      );
      return fuseResults.slice(0, limit);
    }

    const semanticResults = semanticRaw.map((r) => ({
      bookmark: r.bookmark,
      score: r.score,
      pathString: r.bookmark.pathString,
      matchedFields: ["semantic"] as string[],
      highlights: {},
      relevanceFactors: this.calculateRelevanceFactors(
        r.bookmark,
        query,
        r.score,
      ),
    }));

    return this.mergeResults(fuseResults, semanticResults, limit);
  }

  /**
   * Hybrid 渐进式搜索
   * 立即返回 Fuse 结果，通过回调通知 Semantic 合并后的更新
   */
  async searchHybridProgressive(
    query: string,
    options: SearchOptions,
    onUpdate: (results: EnhancedSearchResult[]) => void,
  ): Promise<EnhancedSearchResult[]> {
    const normalizedQuery = this.normalizeQuery(query);
    const limit = options.limit || 20;

    // 立即返回 Fuse 结果
    const fuseResults = await this.searchWithFuse(normalizedQuery, {
      ...options,
      limit: limit * 2,
    });
    const highlighted =
      options.highlight !== false
        ? this.addHighlights(fuseResults, normalizedQuery)
        : fuseResults;

    // 异步执行 Semantic，完成后通知更新
    semanticSearch(normalizedQuery, limit)
      .then((semanticRaw) => {
        if (!semanticRaw.length) return;
        const semanticResults = semanticRaw.map((r) => ({
          bookmark: r.bookmark,
          score: r.score,
          pathString: r.bookmark.pathString,
          matchedFields: ["semantic"] as string[],
          highlights: {},
          relevanceFactors: this.calculateRelevanceFactors(
            r.bookmark,
            normalizedQuery,
            r.score,
          ),
        }));
        const merged = this.mergeResults(fuseResults, semanticResults, limit);
        const mergedHighlighted =
          options.highlight !== false
            ? this.addHighlights(merged, normalizedQuery)
            : merged;
        onUpdate(mergedHighlighted);
      })
      .catch(() => {
        /* Semantic 失败静默处理 */
      });

    return highlighted.slice(0, limit);
  }

  /**
   * 合并 Fuse 和 Semantic 结果，去重并重新评分
   */
  private mergeResults(
    fuseResults: EnhancedSearchResult[],
    semanticResults: EnhancedSearchResult[],
    limit: number,
  ): EnhancedSearchResult[] {
    const merged = new Map<
      string,
      EnhancedSearchResult & { _fuseScore: number; _semanticScore: number }
    >();

    // 录入 Fuse 结果
    for (const r of fuseResults) {
      const key = r.bookmark.url || String(r.bookmark.id);
      merged.set(key, { ...r, _fuseScore: r.score, _semanticScore: 0 });
    }

    // 合并 Semantic 结果
    for (const r of semanticResults) {
      const key = r.bookmark.url || String(r.bookmark.id);
      const existing = merged.get(key);
      if (existing) {
        existing._semanticScore = r.score;
        // 两者都命中时，Fuse 精确匹配权重更高
        const fuseWeight = existing._fuseScore > 0.8 ? 0.6 : 0.35;
        existing.score =
          existing._fuseScore * fuseWeight + r.score * (1 - fuseWeight);
        existing.matchedFields = [
          ...new Set([...existing.matchedFields, "semantic"]),
        ];
      } else {
        merged.set(key, { ...r, _fuseScore: 0, _semanticScore: r.score });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Fuse 查询
   */
  private async searchWithFuse(
    query: string,
    options: SearchOptions,
  ): Promise<EnhancedSearchResult[]> {
    try {
      // 优先使用 Worker
      const workerResults = await queryWorkerAdapter.search(
        query,
        options.limit || 100,
      );
      return this.convertToEnhanced(workerResults, query);
    } catch (_error) {
      // 降级到主线程
      this.logger.warn("QueryService", "Worker 查询失败，降级到主线程");
      const bookmarks = await indexedDBManager.getAllBookmarks();
      const fuseEngine = await this.getFuseEngine();
      const results = fuseEngine.search(query, bookmarks);
      return this.convertToEnhanced(results, query);
    }
  }

  /**
   * Native 查询（Chrome API）
   */
  private normalizeQuery(query: string): string {
    return String(query || "")
      .trim()
      .toLowerCase();
  }

  /**
   * 选择查询策略
   */
  /**
   * 转换为增强结果
   */
  private convertToEnhanced(
    results: Array<{ bookmark: BookmarkRecord; score: number }>,
    query: string,
  ): EnhancedSearchResult[] {
    return results.map((result) => ({
      bookmark: result.bookmark,
      score: result.score,
      pathString: result.bookmark.pathString,
      matchedFields: this.detectMatchedFields(result.bookmark, query),
      highlights: {},
      relevanceFactors: this.calculateRelevanceFactors(
        result.bookmark,
        query,
        result.score,
      ),
    }));
  }

  /**
   * 检测匹配字段
   */
  private detectMatchedFields(
    bookmark: BookmarkRecord,
    query: string,
  ): string[] {
    const fields: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (bookmark.titleLower.includes(lowerQuery)) {
      fields.push("title");
    }
    if (bookmark.urlLower?.includes(lowerQuery)) {
      fields.push("url");
    }
    if (bookmark.domain?.toLowerCase().includes(lowerQuery)) {
      fields.push("domain");
    }

    return fields;
  }

  /**
   * 计算相关性因素
   */
  private calculateRelevanceFactors(
    bookmark: BookmarkRecord,
    query: string,
    _baseScore: number,
  ): RelevanceFactors {
    const lowerQuery = query.toLowerCase();

    return {
      titleMatch: bookmark.titleLower.includes(lowerQuery) ? 1.0 : 0.0,
      urlMatch: bookmark.urlLower?.includes(lowerQuery) ? 0.8 : 0.0,
      domainMatch: bookmark.domain?.toLowerCase().includes(lowerQuery)
        ? 0.6
        : 0.0,
      keywordMatch: 0.0, // TODO: 实现关键词匹配
      exactMatch: bookmark.titleLower === lowerQuery ? 1.0 : 0.0,
      recencyBoost: 0.0, // TODO: 实现最近使用加分
      clickBoost: 0.0, // TODO: 实现点击频率加分
    };
  }

  /**
   * 添加高亮
   */
  private addHighlights(
    results: EnhancedSearchResult[],
    query: string,
  ): EnhancedSearchResult[] {
    return results.map((result) => ({
      ...result,
      highlights: {
        title: this.highlightEngine.highlight(result.bookmark.title, query),
        url: result.bookmark.url
          ? this.highlightEngine.highlight(result.bookmark.url, query)
          : [],
      },
    }));
  }

  /**
   * 排序结果
   */
  private sortResults(
    results: EnhancedSearchResult[],
    options: SearchOptions,
  ): EnhancedSearchResult[] {
    const { sortBy = "relevance", sortOrder = "desc" } = options;

    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "relevance":
          comparison = b.score - a.score;
          break;
        case "title":
          comparison = a.bookmark.title.localeCompare(b.bookmark.title);
          break;
        case "date":
          comparison =
            (b.bookmark.dateAdded || 0) - (a.bookmark.dateAdded || 0);
          break;
        default:
          comparison = b.score - a.score;
      }

      return sortOrder === "asc" ? -comparison : comparison;
    });

    return results;
  }

  /**
   * 创建元数据
   */
  private createMetadata(
    startTime: number,
    totalResults: number,
    cacheHit: boolean,
    strategy: string,
    queryNormalized: string,
  ): SearchResultMetadata {
    return {
      searchTime: performance.now() - startTime,
      totalResults,
      cacheHit,
      strategy,
      queryNormalized,
    };
  }

  /**
   * 空响应
   */
  private emptyResponse(startTime: number, strategy: string): SearchResponse {
    return {
      results: [],
      metadata: this.createMetadata(startTime, 0, false, strategy, ""),
    };
  }

  /**
   * 失效缓存
   */
  invalidateCache(pattern?: string): void {
    this.queryCache.invalidate(pattern);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.queryCache.getStats();
  }

  /**
   * 获取索引状态
   */
  getIndexStatus(): IndexStatus {
    return { ...this.indexStatus };
  }
}

// 导出单例
export const queryService = QueryService.getInstance();

// 默认导出
export default queryService;
