/**
 * 查询系统类型定义
 *
 * 注意：所有类型已迁移到 @/types/domain/query
 * 这里仅重新导出，以保持向后兼容
 */

// 从统一类型定义导入并重新导出
export type {
  SearchOptions,
  SearchStrategy,
  SearchSortBy,
  SortOrder,
  HighlightSegment,
  RelevanceFactors,
  SearchResultMetadata,
  EnhancedSearchResult,
  SearchResponse,
  SearchStats,
  SearchEvent,
  SearchEventType,
  IndexStatus,
  CacheConfig,
  WorkerConfig
} from '@/types/domain/query'
