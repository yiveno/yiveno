/**
 * 爬取任务调度器
 *
 * 职责：并发控制（全局 + 域名级别），顺序执行爬取任务。
 * 去掉了：空闲调度、持久化队列、优先级计算。
 */

import { logger } from '@/infrastructure/logging/logger'
import { CRAWLER_CONFIG, TIMEOUT_CONFIG } from '@/config/constants'
import { crawlBookmarkLocally, type CrawlResult } from './local-crawler-worker'

// ==================== 类型定义 ====================

export interface CrawlTask {
  id: string
  url: string
  bookmarkId: string
  status: 'pending' | 'running' | 'success' | 'failed'
  retryCount: number
  result?: CrawlResult
  error?: string | undefined
}

export interface QueueStatistics {
  total: number
  completed: number
  failed: number
  pending: number
  running: number
  progress: number
}

export interface CrawlOptions {
  onProgress?: (progress: QueueStatistics) => void
  onTaskComplete?: (task: CrawlTask) => void
  onComplete?: (stats: QueueStatistics) => void
  onError?: (error: Error) => void
}

// ==================== 并发控制器 ====================

class ConcurrencyController {
  private readonly MAX_GLOBAL = CRAWLER_CONFIG.CONCURRENCY || 2
  private readonly MAX_PER_DOMAIN = CRAWLER_CONFIG.PER_DOMAIN_CONCURRENCY || 1
  private readonly MIN_DOMAIN_INTERVAL = 1000

  private runningCount = 0
  private domainRunning = new Map<string, number>()
  private domainLastAccess = new Map<string, number>()

  canStart(url: string): boolean {
    try {
      const domain = new URL(url).hostname
      if (this.runningCount >= this.MAX_GLOBAL) return false
      if ((this.domainRunning.get(domain) || 0) >= this.MAX_PER_DOMAIN) return false
      if (Date.now() - (this.domainLastAccess.get(domain) || 0) < this.MIN_DOMAIN_INTERVAL) return false
      return true
    } catch {
      return false
    }
  }

  start(url: string): void {
    try {
      const domain = new URL(url).hostname
      this.runningCount++
      this.domainRunning.set(domain, (this.domainRunning.get(domain) || 0) + 1)
      this.domainLastAccess.set(domain, Date.now())
    } catch { /* ignore */ }
  }

  finish(url: string): void {
    try {
      const domain = new URL(url).hostname
      this.runningCount = Math.max(0, this.runningCount - 1)
      this.domainRunning.set(domain, Math.max(0, (this.domainRunning.get(domain) || 1) - 1))
    } catch { /* ignore */ }
  }
}

// ==================== 调度器 ====================

export class CrawlTaskScheduler {
  private tasks: CrawlTask[] = []
  private concurrency = new ConcurrencyController()
  private statistics: QueueStatistics = {
    total: 0, completed: 0, failed: 0, pending: 0, running: 0, progress: 0
  }
  private isRunning = false
  private currentOptions: CrawlOptions | null = null

  /**
   * 调度批量爬取任务
   */
  async scheduleBookmarksCrawl(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[],
    options: CrawlOptions = {}
  ): Promise<void> {
    this.currentOptions = options

    // URL 去重
    const seen = new Set<string>()
    const newTasks: CrawlTask[] = []

    for (const b of bookmarks) {
      if (!b.url || seen.has(b.url)) continue
      seen.add(b.url)
      newTasks.push({
        id: this.hashURL(b.url),
        url: b.url,
        bookmarkId: b.id,
        status: 'pending',
        retryCount: 0
      })
    }

    this.tasks.push(...newTasks)
    this.updateStats()

    if (!this.isRunning) {
      await this.run()
    }
  }

  getStatistics(): QueueStatistics {
    return { ...this.statistics }
  }

  // ==================== 私有方法 ====================

  private async run(): Promise<void> {
    this.isRunning = true

    while (true) {
      const pending = this.tasks.filter(t => t.status === 'pending')
      if (pending.length === 0) break

      const next = pending.find(t => this.concurrency.canStart(t.url))
      if (!next) {
        await new Promise(resolve => setTimeout(resolve, TIMEOUT_CONFIG.DELAY.CRAWLER_TASK_RETRY))
        continue
      }

      // 不 await，让任务并发执行
      void this.executeTask(next)

      await new Promise(resolve => setTimeout(resolve, CRAWLER_CONFIG.BATCH_INTERVAL_MS || 500))
    }

    // 等待所有运行中的任务完成
    while (this.statistics.running > 0) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    this.isRunning = false
    this.currentOptions?.onComplete?.(this.statistics)
    logger.info('CrawlScheduler', '✅ 所有任务完成', this.statistics)
  }

  private async executeTask(task: CrawlTask): Promise<void> {
    task.status = 'running'
    this.concurrency.start(task.url)
    this.updateStats()

    try {
      const result = await crawlBookmarkLocally(task.url, {
        timeout: TIMEOUT_CONFIG.CRAWLER.REQUEST
      })

      // eslint-disable-next-line require-atomic-updates -- 爬取结果赋值是原子操作，不会有竞态条件
      task.result = result

      if (result.success) {
        // eslint-disable-next-line require-atomic-updates -- 任务状态更新是原子操作，不会有竞态条件
        task.status = 'success'
        this.currentOptions?.onTaskComplete?.(task)
      } else if (task.retryCount < 2 && (result.errorType === 'timeout' || result.errorType === 'network')) {
        task.retryCount++
        task.status = 'pending'
      } else {
        task.status = 'failed'
        task.error = result.error ?? '未知爬取错误'
      }
    } catch (error) {
      // eslint-disable-next-line require-atomic-updates -- 错误处理中的状态更新是原子操作，不会有竞态条件
      task.status = 'failed'
      // eslint-disable-next-line require-atomic-updates -- 错误处理中的错误信息赋值是原子操作，不会有竞态条件
      task.error = String(error)
    } finally {
      this.concurrency.finish(task.url)
      this.updateStats()
      this.currentOptions?.onProgress?.(this.statistics)
    }
  }

  private updateStats(): void {
    this.statistics.total = this.tasks.length
    this.statistics.completed = this.tasks.filter(t => t.status === 'success').length
    this.statistics.failed = this.tasks.filter(t => t.status === 'failed').length
    this.statistics.pending = this.tasks.filter(t => t.status === 'pending').length
    this.statistics.running = this.tasks.filter(t => t.status === 'running').length
    const done = this.statistics.completed + this.statistics.failed
    this.statistics.progress = this.statistics.total > 0
      ? Math.round((done / this.statistics.total) * 100)
      : 0
  }

  private hashURL(url: string): string {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
}

export const crawlTaskScheduler = new CrawlTaskScheduler()
