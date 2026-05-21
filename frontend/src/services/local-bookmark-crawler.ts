/**
 * 本地书签爬虫服务
 *
 * 职责：
 * - 检测书签 URL 是否有效（HTTP 状态码）
 * - 将检测结果存入 IndexedDB（crawlMetadata 表）
 * - 触发特征检测（失效书签标记）
 *
 * 不做：元数据提取、DOM 解析、写回 bookmarks 表
 */

import { crawlBookmarkLocally } from './local-crawler-worker'
import type { CrawlResult } from './local-crawler-worker'
import { crawlTaskScheduler } from './crawl-task-scheduler'
import type { CrawlOptions } from './crawl-task-scheduler'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { CrawlMetadataRecord } from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'

// ==================== 结果保存 ====================

/**
 * 保存爬取结果到 IndexedDB（crawlMetadata 表）
 */
export async function saveCrawlResult(
  bookmarkId: string,
  url: string,
  result: CrawlResult
): Promise<void> {
  try {
    const crawlRecord: CrawlMetadataRecord = {
      bookmarkId,
      url,
      source: 'crawler',
      status: result.success ? 'success' : 'failed',
      httpStatus: result.httpStatus || 0,
      crawlSuccess: result.success,
      crawlCount: 1,
      lastCrawled: Date.now(),
      updatedAt: Date.now(),
      version: '2.0'
    }

    await indexedDBManager.saveCrawlMetadata(crawlRecord)

    // ⚠️ 临时注释：scheduleTraitRebuildForBookmark 导致 background.js 导入 app-components
    // 特征重建将在前端页面打开时自动执行
    // scheduleTraitRebuildForBookmark(bookmarkId)

    logger.debug('LocalCrawler', `💾 保存爬取结果: ${url} → HTTP ${result.httpStatus ?? 'N/A'}`)
  } catch (error) {
    logger.error('LocalCrawler', `❌ 保存失败: ${url}`, error)
    throw error
  }
}

// ==================== 高级 API ====================

/**
 * 爬取单个书签（检测是否有效）
 */
export async function crawlSingleBookmark(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  options?: { timeout?: number; force?: boolean }
): Promise<void> {
  if (!bookmark.url) return

  if (!options?.force) {
    const needs = await needsCrawl(bookmark.id)
    if (!needs) {
      logger.debug('LocalCrawler', `跳过（已有最新数据）: ${bookmark.url}`)
      return
    }
  }

  try {
    const result = await crawlBookmarkLocally(bookmark.url, {
      ...(options?.timeout !== undefined ? { timeout: options.timeout } : {})
    })
    await saveCrawlResult(bookmark.id, bookmark.url, result)
  } catch (error) {
    logger.error('LocalCrawler', `❌ 爬取异常: ${bookmark.url}`, error)
    throw error
  }
}

/**
 * 批量爬取书签（使用任务调度器）
 */
export async function crawlMultipleBookmarks(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  options?: CrawlOptions & { skipExisting?: boolean }
): Promise<void> {
  let targets = bookmarks.filter(
    b => b.url && !b.url.startsWith('chrome://')
  )

  if (options?.skipExisting) {
    const filtered: chrome.bookmarks.BookmarkTreeNode[] = []
    for (const b of targets) {
      if (await needsCrawl(b.id)) filtered.push(b)
    }
    targets = filtered
    logger.info('LocalCrawler', `过滤后需要爬取: ${targets.length}/${bookmarks.length}`)
  }

  if (targets.length === 0) {
    logger.info('LocalCrawler', '没有需要爬取的书签')
    return
  }

  logger.info('LocalCrawler', `🚀 批量爬取: ${targets.length} 个书签`)

  await crawlTaskScheduler.scheduleBookmarksCrawl(targets, {
    ...options,
    onTaskComplete: async task => {
      if (task.result) {
        try {
          await saveCrawlResult(task.bookmarkId, task.url, task.result)
          options?.onTaskComplete?.(task)
        } catch (error) {
          logger.error('LocalCrawler', `保存任务结果失败: ${task.url}`, error)
        }
      }
    }
  })
}

/**
 * 获取书签的爬取元数据
 */
export async function getBookmarkMetadata(
  bookmarkId: string
): Promise<CrawlMetadataRecord | null> {
  await indexedDBManager.initialize()
  return indexedDBManager.getCrawlMetadata(bookmarkId)
}

/**
 * 删除书签的爬取元数据
 */
export async function deleteBookmarkMetadata(bookmarkId: string): Promise<void> {
  try {
    await indexedDBManager.initialize()
    await indexedDBManager.deleteCrawlMetadata(bookmarkId)
    logger.info('LocalCrawler', `✅ 删除元数据: ${bookmarkId}`)
  } catch (error) {
    logger.error('LocalCrawler', `❌ 删除元数据失败: ${bookmarkId}`, error)
    throw error
  }
}

/**
 * 检查书签是否需要爬取
 * - 无记录 → 需要
 * - 失败超过 1 天 → 需要重试
 * - 成功超过 30 天 → 需要刷新
 */
export async function needsCrawl(bookmarkId: string): Promise<boolean> {
  await indexedDBManager.initialize()
  const metadata = await indexedDBManager.getCrawlMetadata(bookmarkId)
  if (!metadata) return true

  const daysSince = (Date.now() - (metadata.lastCrawled || 0)) / (1000 * 60 * 60 * 24)
  if (!metadata.crawlSuccess) return daysSince > 1

  const daysSinceUpdate = (Date.now() - metadata.updatedAt) / (1000 * 60 * 60 * 24)
  return daysSinceUpdate > 30
}

/**
 * 获取爬取统计信息
 */
export async function getCrawlStatistics(): Promise<{
  total: number
  withMetadata: number
  withoutMetadata: number
  failed: number
  expired: number
}> {
  await indexedDBManager.initialize()
  const allBookmarks = await indexedDBManager.getAllBookmarks()
  const urlBookmarks = allBookmarks.filter(b => b.url && !b.url.startsWith('chrome://'))

  let withMetadata = 0
  let withoutMetadata = 0
  let failed = 0
  let expired = 0

  for (const bookmark of urlBookmarks) {
    const metadata = await indexedDBManager.getCrawlMetadata(bookmark.id)
    if (!metadata) {
      withoutMetadata++
    } else {
      withMetadata++
      if (!metadata.crawlSuccess) {
        failed++
      } else {
        const days = (Date.now() - metadata.updatedAt) / (1000 * 60 * 60 * 24)
        if (days > 30) expired++
      }
    }
  }

  return { total: urlBookmarks.length, withMetadata, withoutMetadata, failed, expired }
}

// ==================== 工具函数 ====================

// ⚠️ 临时注释：scheduleTraitRebuildForBookmark 导致 background.js 导入 app-components
// 特征重建将在前端页面打开时自动执行
/*
function scheduleTraitRebuildForBookmark(bookmarkId: string): void {
  import('./bookmark-trait-service')
    .then(({ scheduleTraitRebuildForIds }) => {
      scheduleTraitRebuildForIds([bookmarkId], 'crawler-complete')
    })
    .catch(error => {
      logger.warn('LocalCrawler', '触发特征检测失败', error)
    })
}
*/
