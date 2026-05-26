/**
 * 后台爬取管理器
 *
 * 职责：
 * - 在 Service Worker 后台运行爬取调度器
 * - 使用 chrome.alarms 定期触发自动爬取
 * - 响应前端页面的手动爬取请求
 * - 广播爬取进度到所有打开的页面
 *
 * 架构：
 * - 调度器运行在 Service Worker（持续可用）
 * - 使用 Offscreen Document 进行 DOM 解析
 * - 通过 chrome.runtime.sendMessage 与前端通信
 */

import { logger } from '@/infrastructure/logging/logger'
import { crawlTaskScheduler } from '@/services/crawl-task-scheduler'
import { getCrawlStatistics, crawlMultipleBookmarks } from '@/services/local-bookmark-crawler'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

declare global {
  var __crawlerMonitorTimer: ReturnType<typeof setInterval> | null | undefined

  var __crawlerClearConfirmed: boolean | null | undefined

  var crawlerDebug: unknown
}

/**
 * ✅ 优化：后台爬取管理器（事件驱动）
 *
 * @remarks
 * 架构优化说明：
 * - 移除周期性爬取（避免浪费资源）
 * - 改为事件驱动：新书签创建时立即爬取
 * - 保留消息监听器以响应前端手动触发
 */
export class BackgroundCrawlerManager {
  private readonly ALARM_NAME = 'crawl-periodic' as const

  constructor() {
    this.initialize()
  }

  /**
   * 初始化管理器
   */
  private async initialize() {
    logger.info('BackgroundCrawler', '🚀 初始化后台爬取管理器（事件驱动模式）...')

    // 1. 清除旧的周期性 alarm（向后兼容）
    this.clearLegacyPeriodicCrawl()

    // 2. 注册消息监听器（响应前端请求）
    this.registerMessageListener()

    logger.info('BackgroundCrawler', '✅ 后台爬取管理器初始化完成（事件驱动模式）')
  }

  // ==================== 清理旧配置 ====================

  /**
   * 清除旧的周期性爬取 alarm（向后兼容）
   */
  private clearLegacyPeriodicCrawl() {
    chrome.alarms.clear(this.ALARM_NAME, wasCleared => {
      if (wasCleared) {
        logger.info('BackgroundCrawler', '✅ 已清除旧的周期性爬取定时器（优化：改为事件驱动）')
      }
    })
  }

  // ==================== 消息监听 ====================

  /**
   * 注册消息监听器（响应前端页面请求）
   */
  private registerMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      logger.debug('BackgroundCrawler', '收到消息', { type: message.type })

      // ✅ 仅保留进度查询功能（用于显示，不用于控制）
      if (message.type === 'GET_CRAWL_PROGRESS') {
        try {
          const progress = crawlTaskScheduler.getStatistics()
          sendResponse({ success: true, progress })
        } catch (error) {
          logger.error('BackgroundCrawler', '获取进度失败', error)
          sendResponse({ success: false, error: String(error) })
        }
        return false
      }
      // 未知消息类型
      logger.debug('BackgroundCrawler', '未知消息类型（已忽略）', {
        type: message.type
      })
      sendResponse({ success: false, error: `未知消息类型: ${message.type}` })
      return false
    })

    logger.info('BackgroundCrawler', '✅ 消息监听器已注册')
  }
}

/**
 * 全局单例实例
 */
export const backgroundCrawlerManager = new BackgroundCrawlerManager()

/**
 * 批量删除爬取元数据（辅助函数，用于减少嵌套深度）
 */
async function batchDeleteCrawlMetadata(): Promise<{ total: number; deleted: number }> {
  await indexedDBManager.initialize()

  const allBookmarks = await indexedDBManager.getAllBookmarks()
  const urlBookmarks = allBookmarks.filter(b => b.url && !b.url.startsWith('chrome://'))

  console.log(`📋 找到 ${urlBookmarks.length} 个书签的爬虫数据`)

  let deletedCount = 0
  for (const bookmark of urlBookmarks) {
    try {
      await indexedDBManager.deleteCrawlMetadata(bookmark.id)
      deletedCount++
    } catch {
      // 忽略单个删除失败
    }

    if (deletedCount > 0 && deletedCount % 100 === 0) {
      console.log(`🗑️ 已删除 ${deletedCount}/${urlBookmarks.length}...`)
    }
  }

  return { total: urlBookmarks.length, deleted: deletedCount }
}

// ==================== 调试工具（全局暴露） ====================

/**
 * 爬虫调试工具
 *
 * 使用方法（在 Chrome DevTools Console 中）：
 * ```js
 * // 查看当前进度
 * await crawlerDebug.getProgress()
 *
 * // 查看详细统计
 * await crawlerDebug.getStats()
 *
 * // 启动实时监控（每秒输出一次）
 * crawlerDebug.startMonitor()
 *
 * // 停止监控
 * crawlerDebug.stopMonitor()
 *
 * // 测试爬取前 5 个书签
 * await crawlerDebug.testCrawl(5)
 *
 * // 爬取所有书签（跳过已有数据，推荐）
 * await crawlerDebug.crawlAll()
 *
 * // 爬取所有书签（不跳过已有数据）
 * await crawlerDebug.crawlAll({ skipExisting: false })
 *
 * // 强制重新爬取所有书签
 * await crawlerDebug.crawlAll({ force: true })
 * ```
 */
export const crawlerDebug = {
  /**
   * 获取当前爬虫进度
   */
  getProgress: () => {
    const stats = crawlTaskScheduler.getStatistics()
    console.log('📊 爬虫进度:', stats)
    console.table([
      { 指标: '总任务', 数值: stats.total },
      { 指标: '运行中', 数值: stats.running },
      { 指标: '等待中', 数值: stats.pending },
      { 指标: '已完成', 数值: stats.completed },
      { 指标: '失败', 数值: stats.failed },
      { 指标: '进度', 数值: `${stats.progress}%` }
    ])
    return stats
  },

  /**
   * 获取详细统计信息
   */
  getStats: async () => {
    const stats = await getCrawlStatistics()
    console.log('📈 爬取统计:', stats)
    console.table([
      { 指标: '书签总数', 数值: stats.total },
      { 指标: '已爬取', 数值: stats.withMetadata },
      { 指标: '未爬取', 数值: stats.withoutMetadata },
      { 指标: '失败', 数值: stats.failed },
      { 指标: '过期(>30天)', 数值: stats.expired }
    ])
    return stats
  },

  /**
   * 启动实时监控（每秒输出一次）
   */
  startMonitor: () => {
    if (globalThis.__crawlerMonitorTimer) {
      console.warn('⚠️ 监控已在运行中')
      return
    }

    console.log('▶️ 启动爬虫实时监控（每秒刷新）')
    globalThis.__crawlerMonitorTimer = setInterval(() => {
      const stats = crawlTaskScheduler.getStatistics()
      const timestamp = new Date().toLocaleTimeString()
      console.log(
        `[${timestamp}] 📊 进度: ${stats.progress}% | 运行: ${stats.running} | 等待: ${stats.pending} | 完成: ${stats.completed} | 失败: ${stats.failed}`
      )
    }, 1000)
  },

  /**
   * 停止实时监控
   */
  stopMonitor: () => {
    if (globalThis.__crawlerMonitorTimer) {
      clearInterval(globalThis.__crawlerMonitorTimer)
      globalThis.__crawlerMonitorTimer = null
      console.log('⏸️ 已停止爬虫监控')
    } else {
      console.warn('⚠️ 监控未运行')
    }
  },

  /**
   * 测试爬取（前 N 个书签）
   */
  testCrawl: async (count = 5) => {
    console.log(`🚀 开始测试爬取（前 ${count} 个书签）`)

    await indexedDBManager.initialize()
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const urlBookmarks = allBookmarks.filter(b => b.url && !b.url.startsWith('chrome://'))
    const testBookmarks = urlBookmarks.slice(0, count)

    console.log(`📋 选中 ${testBookmarks.length} 个书签:`)
    testBookmarks.forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.title} - ${b.url}`)
    })

    await crawlMultipleBookmarks(testBookmarks as unknown as chrome.bookmarks.BookmarkTreeNode[], {
      skipExisting: false,
      onProgress: progress => {
        console.log(`📊 进度更新: ${progress.progress}%`, progress)
      },
      onTaskComplete: task => {
        const status = task.status === 'success' ? '✅' : '❌'
        console.log(`${status} ${task.url} - HTTP ${task.result?.httpStatus ?? 'N/A'}`)
      },
      onComplete: stats => {
        console.log('🎉 测试爬取完成!', stats)
      }
    })
  },

  /**
   * 爬取所有书签（跳过已有数据）
   */
  crawlAll: async (options?: { skipExisting?: boolean; force?: boolean }) => {
    const skipExisting = options?.force ? false : (options?.skipExisting ?? true)

    console.log(`🚀 开始爬取所有书签（skipExisting: ${skipExisting}）`)

    await indexedDBManager.initialize()
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const urlBookmarks = allBookmarks.filter(b => b.url && !b.url.startsWith('chrome://'))

    console.log(`📋 找到 ${urlBookmarks.length} 个书签`)

    await crawlMultipleBookmarks(urlBookmarks as unknown as chrome.bookmarks.BookmarkTreeNode[], {
      skipExisting,
      onProgress: progress => {
        const timestamp = new Date().toLocaleTimeString()
        console.log(
          `[${timestamp}] 📊 ${progress.progress}% | 运行: ${progress.running} | 等待: ${progress.pending} | 完成: ${progress.completed} | 失败: ${progress.failed}`
        )
      },
      onTaskComplete: task => {
        const status = task.status === 'success' ? '✅' : '❌'
        const httpStatus = task.result?.httpStatus ?? 'N/A'
        console.log(`${status} [HTTP ${httpStatus}] ${task.url}`)
      },
      onComplete: stats => {
        console.log('🎉 所有书签爬取完成!')
        console.table([
          { 指标: '总任务', 数值: stats.total },
          { 指标: '已完成', 数值: stats.completed },
          { 指标: '失败', 数值: stats.failed },
          { 指标: '成功率', 数值: `${Math.round((stats.completed / stats.total) * 100)}%` }
        ])
      },
      onError: error => {
        console.error('❌ 爬取过程出错:', error)
      }
    })
  },

  /**
   * 清空所有爬虫数据（格式化）
   */
  clearAll: async () => {
    console.warn('⚠️ 即将清空所有爬虫数据，此操作不可恢复！')
    console.log('💡 如需确认，请在 5 秒内输入: crawlerDebug.confirmClear()')
    globalThis.__crawlerClearConfirmed = false

    setTimeout(() => {
      if (!globalThis.__crawlerClearConfirmed) {
        console.log('⏱️ 清空操作已取消（超时）')
        globalThis.__crawlerClearConfirmed = undefined
      }
    }, 5000)
  },

  /**
   * 确认清空所有爬虫数据
   */
  confirmClear: async () => {
    if (globalThis.__crawlerClearConfirmed === false) {
      globalThis.__crawlerClearConfirmed = true

      console.log('🗑️ 开始清空爬虫数据...')

      try {
        const { total, deleted } = await batchDeleteCrawlMetadata()

        console.log('✅ 爬虫数据清空完成!')
        console.table([
          { 指标: '总书签数', 数值: total },
          { 指标: '已删除', 数值: deleted },
          { 指标: '失败', 数值: total - deleted }
        ])

        // 清空确认标志
        // eslint-disable-next-line require-atomic-updates
        globalThis.__crawlerClearConfirmed = undefined
      } catch (error) {
        console.error('❌ 清空失败:', error)
        // eslint-disable-next-line require-atomic-updates
        globalThis.__crawlerClearConfirmed = undefined
      }
    } else {
      console.warn('⚠️ 请先执行 crawlerDebug.clearAll() 启动清空流程')
    }
  }
}

// 在 Service Worker 全局作用域暴露调试工具
if (typeof globalThis !== 'undefined') {
  globalThis.crawlerDebug = crawlerDebug
  logger.info('BackgroundCrawler', '🔧 调试工具已暴露: globalThis.crawlerDebug')
}
