/**
 * 应用层：书签查询服务
 *
 * 职责：
 * - 对外提供书签记录读取接口（全部、按父节点、全局统计）；
 * - 依赖核心仓储 `bookmarkRepository`，保持应用层与数据访问的分离；
 * - 所有方法返回 `Result<T>`，便于统一错误处理与 UI 通知。
 */
import type { Result } from '@/core/common/result'
import { ok, err } from '@/core/common/result'
import { bookmarkRepository } from '@/core/bookmark/repositories/bookmark-repository'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import { emitEvent } from '@/infrastructure/events/event-bus'

/** 书签数量摘要统计 */
export interface BookmarkSummaryStats {
  /** 书签总数 */
  bookmarks: number
  /** 今日新增书签数量 */
  todayAdded: number
  /** 最近 30 天内打开过的书签数量 */
  recentlyOpened: number
}

function toBookmarkNode(record: BookmarkRecord): BookmarkNode {
  return {
    id: String(record.id),
    title: record.title,
    ...(record.url !== undefined ? { url: record.url } : {}),
    ...(typeof record.index === 'number' ? { index: record.index } : {}),
    ...(typeof record.dateAdded === 'number' ? { dateAdded: record.dateAdded } : {}),
    children: [],
    ...(typeof record.childrenCount === 'number' ? { childrenCount: record.childrenCount } : {}),
    _childrenLoaded: false,
    ...(record.parentId ? { parentId: String(record.parentId) } : {})
  }
}

/**
 * 书签应用服务，负责协调仓储层与上层调用的交互。
 */
export class BookmarkAppService {
  /** 服务是否已初始化 */
  private initialized = false

  /**
   * 初始化服务
   */
  async initialize(): Promise<Result<void>> {
    try {
      if (this.initialized) {
        return ok(undefined)
      }

      logger.info('BookmarkAppService', '初始化书签服务...')
      this.initialized = true
      return ok(undefined)
    } catch (error) {
      logger.error('BookmarkAppService', '初始化失败', error)
      return err(new Error('初始化书签服务失败'))
    }
  }

  /**
   * 读取全部书签记录（含文件夹与书签），从 IndexedDB 仓储获取。
   */
  async getAllBookmarks(limit?: number, offset?: number): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getAllBookmarks(limit, offset)
  }

  /**
   * 根据ID获取单个书签记录
   *
   * @param id - 书签的唯一标识符
   * @returns 包含书签记录的 Result 对象，如果不存在则返回 null
   */
  async getBookmarkById(id: string): Promise<Result<BookmarkRecord | null>> {
    return bookmarkRepository.getBookmarkById(id)
  }

  /**
   * 获取根节点
   */
  async getRootNodes(): Promise<Result<BookmarkNode[]>> {
    try {
      const result = await bookmarkRepository.getChildrenByParentId('0', 0, 100)
      if (result.ok && result.value) {
        // 转换 BookmarkRecord 为 BookmarkNode
        const nodes: BookmarkNode[] = result.value.map(record => toBookmarkNode(record))
        return ok(nodes)
      }
      return err(new Error('获取根节点失败'))
    } catch (error) {
      logger.error('BookmarkAppService', '获取根节点失败', error)
      return err(new Error('获取根节点失败'))
    }
  }

  /**
   * 获取子节点
   */
  async getChildren(
    parentId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<BookmarkNode[]>> {
    try {
      const result = await bookmarkRepository.getChildrenByParentId(
        parentId,
        options?.offset || 0,
        options?.limit || 100
      )
      if (result.ok && result.value) {
        // 转换 BookmarkRecord 为 BookmarkNode
        const nodes: BookmarkNode[] = result.value.map(record => toBookmarkNode(record))
        return ok(nodes)
      }
      return err(new Error('获取子节点失败'))
    } catch (error) {
      logger.error('BookmarkAppService', '获取子节点失败', error)
      return err(new Error('获取子节点失败'))
    }
  }

  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number
  ): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getChildrenByParentId(parentId, offset, limit)
  }

  /**
   * 创建书签
   *
   * 🆕 架构改进：通过 Background Script 统一处理
   * Chrome API → Background → IndexedDB → UI
   */
  async createBookmark(data: {
    title: string
    url?: string
    parentId?: string
  }): Promise<Result<BookmarkNode>> {
    try {
      // ✅ 通过消息传递给 Background Script
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_BOOKMARK',
        data: {
          title: data.title,
          url: data.url,
          parentId: data.parentId || '1'
        }
      })

      if (!response.success) {
        throw new Error(response.error || '创建书签失败')
      }

      const node = response.bookmark
      const bookmarkNode: BookmarkNode = {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: node.parentId,
        index: node.index,
        dateAdded: node.dateAdded,
        children: []
      }

      return ok(bookmarkNode)
    } catch (error) {
      logger.error('BookmarkAppService', '创建书签失败', error)
      return err(error instanceof Error ? error : new Error('创建书签失败'))
    }
  }

  /**
   * 更新书签
   *
   * 🆕 架构改进：通过 Background Script 统一处理
   * Chrome API → Background → IndexedDB → UI
   */
  async updateBookmark(
    id: string,
    data: { title?: string; url?: string; parentId?: string }
  ): Promise<Result<BookmarkNode>> {
    try {
      // ✅ 通过消息传递给 Background Script
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_BOOKMARK',
        data: {
          id,
          title: data.title,
          url: data.url
        }
      })

      if (!response.success) {
        throw new Error(response.error || '更新书签失败')
      }

      const node = response.bookmark
      const bookmarkNode: BookmarkNode = {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: node.parentId,
        index: node.index,
        dateAdded: node.dateAdded,
        children: []
      }

      return ok(bookmarkNode)
    } catch (error) {
      logger.error('BookmarkAppService', '更新书签失败', error)
      return err(error instanceof Error ? error : new Error('更新书签失败'))
    }
  }

  /**
   * 删除书签
   *
   * 🆕 架构改进：通过 Background Script 统一处理
   * Chrome API → Background → IndexedDB → UI
   */
  async deleteBookmark(id: string): Promise<Result<void>> {
    try {
      // ✅ 通过消息传递给 Background Script
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_BOOKMARK',
        data: { id }
      })

      if (!response.success) {
        throw new Error(response.error || '删除书签失败')
      }

      return ok(undefined)
    } catch (error) {
      logger.error('BookmarkAppService', '删除书签失败', error)
      return err(error instanceof Error ? error : new Error('删除书签失败'))
    }
  }

  async getGlobalStats(): Promise<Result<unknown>> {
    return bookmarkRepository.getGlobalStats()
  }

  /**
   * 获取最近访问的书签列表
   */
  async getRecentVisits(limit: number = 10): Promise<Result<BookmarkRecord[]>> {
    return bookmarkRepository.getRecentVisits(limit)
  }

  /**
   * 清除书签访问记录
   */
  async clearVisitRecord(bookmarkId: string): Promise<Result<void>> {
    try {
      return await bookmarkRepository.clearVisitRecord(bookmarkId)
    } catch (error) {
      logger.error('BookmarkAppService', '清除访问记录失败', error)
      return err(error instanceof Error ? error : new Error('清除访问记录失败'))
    }
  }

  /**
   * 计算书签摘要统计（总数、今日新增、近期打开）
   */
  async getBookmarkSummaryStats(): Promise<Result<BookmarkSummaryStats>> {
    try {
      const result = await this.getAllBookmarks()
      if (!result.ok || !result.value) {
        return err(new Error('获取书签统计失败'))
      }

      const allBookmarks = result.value
      const totalBookmarks = allBookmarks.filter(b => !b.isFolder).length

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayTimestamp = todayStart.getTime()

      const todayAdded = allBookmarks.filter(
        b => !b.isFolder && b.dateAdded && b.dateAdded >= todayTimestamp
      ).length

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const recentlyOpened = allBookmarks.filter(
        b => !b.isFolder && b.lastVisited && b.lastVisited >= thirtyDaysAgo
      ).length

      return ok({
        bookmarks: totalBookmarks,
        todayAdded,
        recentlyOpened
      })
    } catch (error) {
      logger.error('BookmarkAppService', '计算书签统计失败', error)
      return err(error instanceof Error ? error : new Error('计算书签统计失败'))
    }
  }

  /**
   * 检查书签库是否已有数据
   */
  async hasBookmarkData(): Promise<Result<boolean>> {
    const sample = await this.getAllBookmarks(1)
    if (!sample.ok) {
      return err(sample.error ?? new Error('检查书签数据失败'))
    }
    return ok((sample.value?.length ?? 0) > 0)
  }

  /**
   * 更新书签访问记录
   *
   * @param bookmarkId - 书签ID
   * @returns Result<void>
   */
  async updateVisitRecord(bookmarkId: string): Promise<Result<void>> {
    try {
      logger.info('BookmarkAppService', '📊 更新访问记录', { id: bookmarkId })

      // 获取当前书签数据
      const bookmarkResult = await bookmarkRepository.getBookmarkById(bookmarkId)
      if (!bookmarkResult.ok || !bookmarkResult.value) {
        logger.warn('BookmarkAppService', '书签不存在', bookmarkId)
        return err(new Error('书签不存在'))
      }

      const bookmark = bookmarkResult.value

      // 更新访问记录
      const now = Date.now()
      const updateResult = await bookmarkRepository.updateBookmark(bookmarkId, {
        lastVisited: now,
        visitCount: (bookmark.visitCount || 0) + 1
      })

      if (!updateResult.ok) {
        return err(new Error('更新访问记录失败'))
      }

      logger.debug('BookmarkAppService', '✅ 访问记录已更新', {
        id: bookmarkId,
        lastVisited: now,
        visitCount: (bookmark.visitCount || 0) + 1
      })

      // 触发事件，通知 RecentVisits 组件刷新
      emitEvent('bookmark:visited', { id: bookmarkId, timestamp: now })

      return ok(undefined)
    } catch (error) {
      logger.error('BookmarkAppService', '更新访问记录失败', error)
      return err(error instanceof Error ? error : new Error('更新访问记录失败'))
    }
  }
}

export const bookmarkAppService = new BookmarkAppService()
