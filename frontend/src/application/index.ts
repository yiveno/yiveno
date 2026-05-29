/**
 * 应用服务层统一导出
 */

export * from './bookmark/bookmark-app-service'
export * from './bookmark/bookmark-index-app-service'
export * from './bookmark/bookmark-trait-query-service'

export * from './settings/settings-app-service'
export * from './font/font-service'

// 搜索服务：统一导出
export { BookmarkSearchService, bookmarkSearchService } from './query/bookmark-search-service'
export { bookmarkMemorySearchService } from './query/bookmark-memory-search-service'

// AI 服务
export { AIAppService, aiAppService } from './ai/ai-app-service'

// 推荐服务
export {
  getSmartRecommendationEngine,
  type SmartRecommendation,
  type RecommendationType,
  type RecommendationReason,
  type RecommendationContext
} from './bookmark/recommendation-app-service'
