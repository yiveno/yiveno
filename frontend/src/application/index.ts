/**
 * 应用服务层统一导出
 */

export * from './bookmark/bookmark-app-service'
export * from './bookmark/bookmark-index-app-service'
export * from './bookmark/bookmark-trait-query-service'
// cleanup-app-service 已移除：现在使用 trait-filter-store 进行筛选

// ⚠️ notification-service 不在这里导出，因为它依赖 Vue
// 如果需要使用，请直接导入：
// import { notificationService } from '@/application/notification/notification-service'
// export * from './notification/notification-service'  // ❌ 已禁用

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
