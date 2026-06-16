/**
 * 基础设施层统一导出
 */

// IndexedDB
export * from './indexeddb/schema'

// 存储
export * from './storage/chrome-storage'

// 日志
export * from './logging/logger'

// 国际化
export * from './i18n/i18n-service'

// 全局状态管理
export * from './global-state/global-state-manager'

// 基础设施服务（同步、导航、Worker 等）
export { bookmarkSyncService } from './services/bookmark-sync-service'
export { navigationService } from './services/navigation-service'
export { faviconService } from './services/favicon-service'
export { queryWorkerAdapter } from './services/query-worker-adapter'
export { getPerformanceMonitor } from './services/query-performance-monitor'
export { trpc } from './services/trpc'
export { initializeBookmarkTraitAutoSync } from './services/bookmark-trait-auto-sync'
export {
  scheduleFullTraitRebuild,
  scheduleTraitRebuildForIds
} from './services/bookmark-trait-service'
