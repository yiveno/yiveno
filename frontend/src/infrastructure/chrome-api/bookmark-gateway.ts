/**
 * 书签 API 网关 - 基于 Chrome Bookmarks API
 *
 * 职责与边界：
 * - 负责事件监听、原生能力增强与统一到应用层服务（如 queryAppService）的代理
 * - 关注"现代"特性（dateLastUsed、folderType、事件桥接等），不直接承载页面筛选逻辑
 * - 与 Lightweight 增强器的关系：Lightweight 专注低成本元数据抓取与缓存；
 *   BookmarkAPIGateway 专注原生事件/特性与到应用层服务的桥接
 *
 * 新特性：
 * - Chrome 114+ dateLastUsed 使用频率跟踪
 * - Chrome 134+ folderType 文件夹类型识别
 * - 实时事件同步
 * - 混合筛选策略（代理到应用层 queryAppService）
 * - 智能推荐系统
 */
import { logger } from '@/infrastructure/logging/logger'
import { AB_EVENTS } from '@/constants/events'
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import { dispatchCoalescedEvent } from '@/infrastructure/events/event-stream'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

export interface EnhancedBookmarkNode extends chrome.bookmarks.BookmarkTreeNode {
  dateLastUsed?: number // Chrome 114+
  folderType?: 'bookmarks-bar' | 'other' | 'mobile' | 'managed' // Chrome 134+
  usageScore?: number // 自定义：使用频率评分
  recommendationScore?: number // 自定义：推荐评分
  domain?: string // 预计算域名，减少运行时解析
}

export interface BookmarkSearchOptions {
  query: string
  maxResults?: number
  includeUsageData?: boolean
  sortBy?: 'relevance' | 'recent' | 'usage' | 'created'
  folderTypes?: string[]
}

export interface BookmarkRecommendationContext {
  currentUrl?: string
  currentDomain?: string
  timeOfDay?: number
  dayOfWeek?: number
}

// 背景脚本通知消息的最小类型
interface BookmarkUpdateMessage {
  eventType: string
  id: string
  data?: unknown
  timestamp?: number
}

/**
 * 书签 API 网关类
 */
export class BookmarkAPIGateway {
  private static instance: BookmarkAPIGateway | null = null
  private bookmarkCache = new Map<string, EnhancedBookmarkNode>()

  private constructor() {
    this.setupBackgroundMessageListener()
  }

  static getInstance(): BookmarkAPIGateway {
    if (!BookmarkAPIGateway.instance) {
      BookmarkAPIGateway.instance = new BookmarkAPIGateway()
    }
    return BookmarkAPIGateway.instance
  }

  private setupBackgroundMessageListener() {
    if (typeof chrome === 'undefined' || !chrome.runtime) return

    logger.info('Component', '🔗 [前端] 设置Background消息监听器...')

    chrome.runtime.onMessage.addListener(message => {
      if (message.type === 'BOOKMARK_UPDATED') {
        this.handleBackgroundBookmarkUpdate(message)
      }
      if (message.type === 'acuity-bookmarks-db-synced') {
        // 合并与节流：150ms 内仅派发一次
        dispatchCoalescedEvent(
          AB_EVENTS.BOOKMARKS_DB_SYNCED,
          { timestamp: message.timestamp || Date.now() },
          150
        )
        logger.info('Component', '📡 [前端] 已合并派发 acuity-bookmarks-db-synced 事件')
      }
      // 不需要响应，所以不调用sendResponse
    })

    logger.info('Component', '✅ [前端] Background消息监听器设置完成')
  }

  /**
   * 处理来自Background的书签更新通知
   */

  private handleBackgroundBookmarkUpdate(message: unknown) {
    try {
      const m = message as BookmarkUpdateMessage
      logger.info(`🔄 [前端] 收到书签 ${m.eventType} 通知:`, {
        id: m.id,
        timestamp: m.timestamp
      })

      this.invalidateCache()

      // 可以在这里发送自定义事件，通知UI更新
      this.notifyUIBookmarkUpdate(m.eventType, m.id, m.data)
    } catch (error) {
      logger.error('Component', '❌ [前端] 处理Background书签更新失败:', error)
    }
  }

  /**
   * 通知UI书签更新（可扩展为自定义事件系统）
   */

  private notifyUIBookmarkUpdate(eventType: string, id: string, data: unknown) {
    try {
      // 创建自定义事件，让UI组件可以监听
      const detail = {
        eventType,
        id,
        data,
        timestamp: Date.now()
      }
      // 合并与节流：100ms 内仅派发一次同名事件
      dispatchCoalescedEvent(AB_EVENTS.BOOKMARK_UPDATED, detail, 100)
      logger.info('Component', '📡 [前端] 已合并派发 ${eventType} UI更新事件')
    } catch (error) {
      logger.warn('⚠️ [前端] 派发UI事件失败:', error)
    }
  }

  /**
   * 获取增强的书签树 - 从 IndexedDB 读取
   * ✅ 符合单向数据流：Chrome API → Background → IndexedDB → UI
   */
  async getEnhancedBookmarkTree(): Promise<EnhancedBookmarkNode[]> {
    try {
      // ✅ 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      // ✅ 从 IndexedDB 读取书签数据
      const allBookmarks = await indexedDBManager.getAllBookmarks()

      // 从扁平数据构建树结构
      const tree = this.buildTreeFromFlat(allBookmarks)

      return this.enhanceBookmarkNodes(tree)
    } catch (error) {
      logger.error('Component', '❌ 获取书签树失败:', error)
      throw new Error(`获取书签树失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 从扁平的 BookmarkRecord[] 构建树形结构
   */
  private buildTreeFromFlat(bookmarks: BookmarkRecord[]): chrome.bookmarks.BookmarkTreeNode[] {
    const nodeMap = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
    const rootNodes: chrome.bookmarks.BookmarkTreeNode[] = []

    // 第一遍：创建所有节点
    for (const record of bookmarks) {
      const node = {
        id: record.id,
        parentId: record.parentId,
        title: record.title || '',
        url: record.url,
        dateAdded: record.dateAdded,
        dateGroupModified: record.dateGroupModified,
        children: [],
        index: record.index
      } as unknown as chrome.bookmarks.BookmarkTreeNode
      nodeMap.set(record.id, node)
    }

    // 第二遍：建立父子关系
    for (const node of nodeMap.values()) {
      if (!node.parentId || node.parentId === '0') {
        rootNodes.push(node)
      } else {
        const parent = nodeMap.get(node.parentId)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(node)
        } else {
          // 父节点不存在（可能被删除），作为根节点
          rootNodes.push(node)
        }
      }
    }

    return rootNodes
  }

  /**
   * 增强书签节点 - 添加现代特性
   */
  private enhanceBookmarkNodes(nodes: chrome.bookmarks.BookmarkTreeNode[]): EnhancedBookmarkNode[] {
    return nodes.map(node => {
      const enhanced: EnhancedBookmarkNode = {
        ...node,
        usageScore: this.calculateUsageScore(node),
        recommendationScore: 0 // 稍后计算
      }

      // 预计算域名（仅书签节点）
      if (node.url) {
        try {
          enhanced.domain = new URL(node.url).hostname.toLowerCase()
        } catch {}
      }

      // 增强文件夹类型识别（Chrome 134+兼容）
      if (!node.url && !enhanced.folderType) {
        enhanced.folderType = this.determineFolderType(node)
      }

      // 递归处理子节点
      if (node.children) {
        enhanced.children = this.enhanceBookmarkNodes(node.children)
      }

      return enhanced
    })
  }

  /**
   * 确定文件夹类型（向后兼容）
   */
  private determineFolderType(
    node: chrome.bookmarks.BookmarkTreeNode
  ): 'bookmarks-bar' | 'other' | 'mobile' | 'managed' {
    // Chrome 134+ 原生支持
    if ('folderType' in node && node.folderType) {
      return node.folderType
    }

    // 向后兼容的fallback
    switch (node.id) {
      case '1':
        return 'bookmarks-bar'
      case '2':
        return 'other'
      case '3':
        return 'mobile'
      default:
        if (node.title?.includes('管理') || node.title?.includes('Managed')) {
          return 'managed'
        }
        return 'other'
    }
  }

  /**
   * 计算使用频率评分
   */
  private calculateUsageScore(node: chrome.bookmarks.BookmarkTreeNode): number {
    if (!node.url) return 0 // 文件夹没有使用频率

    let score = 0

    // 基于最后使用时间（Chrome 114+）
    const dateLastUsed = (node as EnhancedBookmarkNode).dateLastUsed
    if (dateLastUsed) {
      const daysSinceLastUsed = (Date.now() - dateLastUsed) / (1000 * 60 * 60 * 24)
      score += Math.max(0, 100 - daysSinceLastUsed * 2)
    }

    // 基于创建时间
    if (node.dateAdded) {
      const daysSinceCreated = (Date.now() - node.dateAdded) / (1000 * 60 * 60 * 24)
      if (daysSinceCreated < 7) score += 30 // 最近创建的书签
    }

    return score
  }

  /**
   * 获取最近书签 - 从 IndexedDB 读取
   * ✅ 符合单向数据流：Chrome API → Background → IndexedDB → UI
   */
  async getRecentBookmarks(count: number = 10): Promise<EnhancedBookmarkNode[]> {
    try {
      // ✅ 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      // ✅ 从 IndexedDB 读取所有书签
      const allBookmarks = await indexedDBManager.getAllBookmarks()

      // 过滤并排序：只要书签（有URL），按添加时间倒序
      const recent = allBookmarks
        .filter(b => b.url) // 只要书签，不要文件夹
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        .slice(0, count)

      // 转换为 BookmarkTreeNode 格式
      const nodes = recent.map(record => ({
        id: record.id,
        parentId: record.parentId,
        title: record.title || '',
        url: record.url,
        dateAdded: record.dateAdded,
        dateGroupModified: record.dateGroupModified,
        index: record.index
      })) as chrome.bookmarks.BookmarkTreeNode[]

      return this.enhanceBookmarkNodes(nodes)
    } catch (error) {
      logger.error('Component', '❌ 获取最近书签失败:', error)
      throw new Error(`获取最近书签失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 混合筛选策略 - 结合原生API和自定义逻辑
   */
  /**
   * 智能推荐系统
   */
  async getSmartRecommendations(
    context: BookmarkRecommendationContext = {},
    maxResults: number = 5
  ): Promise<EnhancedBookmarkNode[]> {
    try {
      const tree = await this.getEnhancedBookmarkTree()
      const flatBookmarks = this.flattenBookmarkTree(tree).filter(node => node.url)

      // 计算推荐评分
      const recommendations = flatBookmarks.map(bookmark => ({
        ...bookmark,
        recommendationScore: this.calculateRecommendationScore(bookmark, context)
      }))

      // 按评分排序并返回top结果
      return recommendations
        .sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0))
        .slice(0, maxResults)
    } catch (error) {
      logger.error('Component', '❌ 获取智能推荐失败:', error)
      return []
    }
  }

  /**
   * 计算推荐评分
   */
  private calculateRecommendationScore(
    bookmark: EnhancedBookmarkNode,
    context: BookmarkRecommendationContext
  ): number {
    let score = bookmark.usageScore || 0

    // 域名匹配加分
    if (context.currentDomain) {
      const bDomain =
        (bookmark as EnhancedBookmarkNode).domain ||
        ((): string | null => {
          try {
            return new URL(bookmark.url || '').hostname.toLowerCase()
          } catch {
            return null
          }
        })()
      if (bDomain) {
        if (bDomain === context.currentDomain) {
          score += 50
        } else if (
          bDomain.includes(context.currentDomain) ||
          context.currentDomain.includes(bDomain)
        ) {
          score += 25
        }
      }
    }

    // TODO: 时间相关性加权
    // 可以基于历史使用模式进行时间加权
    // 例如：如果用户通常在工作时间访问某些书签，给这些书签在工作时间更高的分数

    return score
  }

  /**
   * 排序筛选结果
   */
  /**
   * 扁平化书签树
   */
  private flattenBookmarkTree(nodes: EnhancedBookmarkNode[]): EnhancedBookmarkNode[] {
    const flattened: EnhancedBookmarkNode[] = []

    function traverse(nodeArray: EnhancedBookmarkNode[]) {
      for (const node of nodeArray) {
        flattened.push(node)
        if (node.children) {
          traverse(node.children)
        }
      }
    }

    traverse(nodes)
    return flattened
  }

  /**
   * 缓存失效
   */
  private invalidateCache() {
    this.bookmarkCache.clear()
    // 可以在这里添加缓存失效的时间记录
  }
}

// 导出单例实例
export const bookmarkAPIGateway = BookmarkAPIGateway.getInstance()

// 导出便捷函数
export async function getRecentBookmarks(count?: number) {
  return bookmarkAPIGateway.getRecentBookmarks(count)
}

export async function searchBookmarks(options: BookmarkSearchOptions) {
  // 统一代理到应用层搜索服务，保持单一入口
  const limit = options.maxResults ?? 50
  const result = await bookmarkSearchService.search(options.query, {
    limit
  })

  if (!result.ok) {
    throw result.error
  }

  // 将 SearchResult[] 映射为 EnhancedBookmarkNode[]（最小字段集）
  return result.value.map(
    r =>
      ({
        id: r.bookmark.id,
        title: r.bookmark.title,
        url: r.bookmark.url,
        parentId: r.bookmark.parentId,
        dateAdded: r.bookmark.dateAdded,
        // 兼容字段
        dateLastUsed: (r.bookmark as unknown as EnhancedBookmarkNode).dateLastUsed,
        // 预计算域名（若存在）
        domain: r.bookmark.domain
      }) as EnhancedBookmarkNode
  )
}

export async function getBookmarkRecommendations(context?: BookmarkRecommendationContext) {
  return bookmarkAPIGateway.getSmartRecommendations(context)
}
