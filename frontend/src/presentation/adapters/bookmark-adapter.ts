/**
 * 书签展示层适配器
 *
 * 职责：
 * - 隔离组件对基础设施层的直接访问
 * - 提供 UI 友好的接口
 * - 统一错误处理和用户反馈
 * - 数据格式转换
 */

import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import { message } from '@/application/message/message-service'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import type { EnhancedSearchResult } from '@/core/query-engine'

/**
 * 加载结果接口
 */
export interface LoadResult<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

/**
 * 操作结果接口
 */
export interface OperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 书签展示层适配器
 */
export class BookmarkPresentationAdapter {
  /**
   * 获取所有书签（UI 友好的接口）
   *
   * @returns 包含数据、错误和加载状态的结果
   */
  async getBookmarks(): Promise<LoadResult<BookmarkRecord[]>> {
    try {
      const result = await bookmarkAppService.getAllBookmarks()
      if (result.ok) {
        return {
          data: result.value,
          error: null,
          loading: false
        }
      }

      // 统一错误处理
      logger.error('BookmarkAdapter', '获取书签失败', result.error)
      message.error('获取书签失败，请稍后重试')

      return {
        data: null,
        error: result.error,
        loading: false
      }
    } catch (error) {
      logger.error('BookmarkAdapter', '获取书签异常', error)
      message.error('获取书签时发生错误')

      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false
      }
    }
  }

  /**
   * 根据 ID 获取书签
   *
   * @param id - 书签 ID
   * @returns 包含数据、错误和加载状态的结果
   */
  async getBookmarkById(id: string): Promise<LoadResult<BookmarkRecord>> {
    try {
      const result = await bookmarkAppService.getBookmarkById(id)
      if (result.ok && result.value) {
        return {
          data: result.value,
          error: null,
          loading: false
        }
      }

      message.warning('书签不存在')
      return {
        data: null,
        error: new Error('Bookmark not found'),
        loading: false
      }
    } catch (error) {
      logger.error('BookmarkAdapter', '获取书签失败', { id, error })
      message.error('获取书签时发生错误')

      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false
      }
    }
  }

  /**
   * 筛选书签（UI 友好的接口）
   *
   * 从本地 IndexedDB 数据中筛选符合条件的书签
   *
   * @param query - 筛选关键词
   * @param options - 筛选选项
   * @returns 筛选结果数组
   */
  async searchBookmarks(
    query: string,
    options?: { limit?: number }
  ): Promise<EnhancedSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    const result = await bookmarkSearchService.search(query, {
      limit: options?.limit || 50
    })

    if (!result.ok) {
      logger.error('BookmarkAdapter', '筛选书签失败', { query, error: result.error })
      message.error('筛选失败，请稍后重试')
      return []
    }

    return result.value
  }

  /**
   * 获取书签的子节点
   *
   * @param parentId - 父节点 ID
   * @returns 包含数据、错误和加载状态的结果
   */
  async getChildrenByParentId(parentId: string): Promise<LoadResult<BookmarkRecord[]>> {
    try {
      const result = await bookmarkAppService.getChildrenByParentId(parentId)
      if (result.ok) {
        return {
          data: result.value,
          error: null,
          loading: false
        }
      }

      logger.error('BookmarkAdapter', '获取子节点失败', {
        parentId,
        error: result.error
      })
      message.error('获取子节点失败')

      return {
        data: null,
        error: result.error,
        loading: false
      }
    } catch (error) {
      logger.error('BookmarkAdapter', '获取子节点异常', { parentId, error })
      message.error('获取子节点时发生错误')

      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false
      }
    }
  }
}

/**
 * 默认书签适配器实例
 */
export const bookmarkPresentationAdapter = new BookmarkPresentationAdapter()
