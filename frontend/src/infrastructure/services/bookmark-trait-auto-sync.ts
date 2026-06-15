/**
 * 书签特征自动同步服务
 *
 * 职责：
 * - 监听 IndexedDB 书签数据变化
 * - 自动触发特征检测
 * - 统一管理触发逻辑
 *
 * 设计原则：
 * - 自动化：无需手动调用，自动监听变化
 * - 集中化：所有触发逻辑都在这里
 * - 解耦：业务层无需关心特征检测
 */

import { scheduleTraitRebuildForIds, scheduleFullTraitRebuild } from './bookmark-trait-service'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签变化事件类型
 */
export type BookmarkChangeEvent =
  | 'created' // 创建书签
  | 'updated' // 更新书签
  | 'deleted' // 删除书签
  | 'moved' // 移动书签
  | 'synced' // 同步完成
  | 'crawled' // 爬取完成

/**
 * 书签变化监听器
 */
class BookmarkTraitAutoSync {
  private static instance: BookmarkTraitAutoSync

  /**
   * 是否已初始化
   */
  private initialized = false

  /**
   * 获取单例实例
   */
  static getInstance(): BookmarkTraitAutoSync {
    if (!BookmarkTraitAutoSync.instance) {
      BookmarkTraitAutoSync.instance = new BookmarkTraitAutoSync()
    }
    return BookmarkTraitAutoSync.instance
  }

  /**
   * 初始化监听器
   *
   * ✅ 只需调用一次，通常在 background script 启动时
   *
   * ⚠️ 注意：不监听 Chrome 书签 API 事件，避免与 background/bookmarks.ts 重复
   * Chrome API 事件由 background/bookmarks.ts 统一监听并触发特征检测
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('BookmarkTraitAutoSync', '已经初始化，跳过')
      return
    }

    logger.info('BookmarkTraitAutoSync', '初始化书签特征自动同步')

    // ✅ 只监听自定义事件（同步、爬虫等）
    // ❌ 不监听 Chrome 书签 API 事件（由 background/bookmarks.ts 统一处理）
    this.setupCustomEventListeners()

    this.initialized = true
    logger.info('BookmarkTraitAutoSync', '✅ 初始化完成')
  }

  /**
   * 设置自定义事件监听器
   *
   * 监听：
   * - 全量同步完成 → 触发全量特征检测
   * - 爬虫完成 → 触发单个书签的特征检测
   *
   * ⚠️ 注意：增量同步的特征检测由 background/bookmarks.ts 直接触发
   */
  private setupCustomEventListeners(): void {
    // 监听同步完成事件

    chrome.runtime.onMessage.addListener(message => {
      if (message.type === 'ottersage-db-synced') {
        const eventType = message.eventType as
          | 'full-sync'
          | 'incremental'
          | 'created'
          | 'changed'
          | 'moved'
          | 'removed'
        logger.debug('BookmarkTraitAutoSync', `同步完成: ${eventType}`)

        if (eventType === 'full-sync') {
          // 全量同步后，触发全量特征检测
          this.handleFullSync()
        }
        // ✅ 增量同步的特征检测已经在 background/bookmarks.ts 中触发
        // 不需要在这里重复处理
      }

      // 监听爬虫完成事件
      if (message.type === 'ottersage-crawl-complete') {
        const bookmarkId = message.bookmarkId as string
        logger.debug('BookmarkTraitAutoSync', `爬虫完成: ${bookmarkId}`)
        this.handleBookmarkChange('crawled', [bookmarkId])
      }
    })
  }

  /**
   * 处理书签变化
   *
   * @param event - 事件类型
   * @param bookmarkIds - 书签ID列表
   */
  private handleBookmarkChange(event: BookmarkChangeEvent, bookmarkIds: string[]): void {
    if (bookmarkIds.length === 0) return

    logger.debug('BookmarkTraitAutoSync', `触发特征检测: ${event}`, {
      count: bookmarkIds.length,
      ids: bookmarkIds.slice(0, 5) // 只记录前5个
    })

    // 触发特征检测（带防抖，800ms）
    scheduleTraitRebuildForIds(bookmarkIds, `auto-${event}`)
  }

  /**
   * 处理全量同步
   */
  private handleFullSync(): void {
    logger.info('BookmarkTraitAutoSync', '触发全量特征检测')
    scheduleFullTraitRebuild('auto-full-sync')
  }

  /**
   * 手动触发特征检测
   *
   * @param bookmarkIds - 书签ID列表（可选，不传则全量检测）
   */
  manualTrigger(bookmarkIds?: string[]): void {
    if (bookmarkIds && bookmarkIds.length > 0) {
      logger.info('BookmarkTraitAutoSync', `手动触发特征检测: ${bookmarkIds.length} 个书签`)
      scheduleTraitRebuildForIds(bookmarkIds, 'manual-trigger')
    } else {
      logger.info('BookmarkTraitAutoSync', '手动触发全量特征检测')
      scheduleFullTraitRebuild('manual-trigger')
    }
  }
}

/**
 * 全局单例实例
 */
export const bookmarkTraitAutoSync = BookmarkTraitAutoSync.getInstance()

/**
 * 初始化书签特征自动同步
 *
 * ✅ 在 background script 启动时调用一次即可
 *
 * @example
 * ```typescript
 * // background/index.ts
 * import { initializeBookmarkTraitAutoSync } from '@/infrastructure/services/bookmark-trait-auto-sync'
 *
 * initializeBookmarkTraitAutoSync()
 * ```
 */
export function initializeBookmarkTraitAutoSync(): void {
  bookmarkTraitAutoSync.initialize()
}
