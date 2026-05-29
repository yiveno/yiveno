/**
 * 查询模块统一导出
 */

// 核心查询引擎
export { SearchEngine } from './engine'
export type { SearchStrategy as SearchEngineStrategy } from './engine'

// 查询策略
export { semanticSearch } from './strategies/semantic-strategy'

// 意图识别
export { detectIntent } from './intent-detector'
export type { QueryIntent, IntentResult } from './intent-detector'

// 查询服务
export { QueryService, queryService } from './query-service'

// 查询缓存
export { QueryCache } from './query-cache'

// 高亮引擎
export { HighlightEngine } from './highlight'

// 类型定义 (重新导出自 @/types)
export type {
  SearchOptions,
  EnhancedSearchResult,
  SearchResponse,
  SearchResultMetadata,
  HighlightSegment,
  RelevanceFactors,
  SearchStats,
  SearchEvent,
  SearchEventType,
  IndexStatus,
  CacheConfig,
  WorkerConfig
} from '@/types/domain/query'
