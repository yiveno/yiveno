/**
 * Popup Store - IndexedDB版本
 * 完全基于IndexedDB，移除chrome.storage.local依赖
 * 支持十万条书签的高性能搜索
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { tabBrowserAppService } from '@/application/browser/tab-browser-app-service'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签数量统计，用于展示总书签条目。
 */
export interface BookmarkStats {
  /** 书签总数 */
  bookmarks: number
  /** 今日新增书签数量 */
  todayAdded: number
  /** 最近打开书签数量（通过插件打开） */
  recentlyOpened: number
}

/**
 * 弹窗状态管理存储 - IndexedDB版本
 */
export const usePopupStoreIndexedDB = defineStore('popup-indexeddb', () => {
  // ==================== 状态 ====================

  // 统一书签API
  // const bookmarkAPI = popupAPI - 已通过导入可用

  // 加载状态
  /** 当前是否处于加载数据状态 */
  const isLoading = ref(false)
  /** 最近一次操作的错误消息 */
  const lastError = ref<string | null>(null)

  // 当前标签页信息
  /** 当前激活标签页 URL */
  const currentTabUrl = ref('')
  /** 当前激活标签页标题 */
  const currentTabTitle = ref('')
  /** 当前激活标签页 ID */
  const currentTabId = ref<number | null>(null)

  // 书签统计
  /** 书签统计信息 */
  const stats = ref<BookmarkStats>({
    bookmarks: 0,
    todayAdded: 0,
    recentlyOpened: 0
  })

  // ==================== 计算属性 ====================

  /** 当前是否存在可用的激活标签页 */
  const hasCurrentTab = computed(() => {
    return currentTabId.value !== null && currentTabUrl.value.length > 0
  })

  /** 统计总条目数 */
  const totalItems = computed(() => stats.value.bookmarks)

  // ==================== 方法 ====================

  /**
   * 确保 IndexedDB 已有书签数据；若为空则等待或请求 Background 全量同步
   */
  async function ensureBookmarkDataReady(): Promise<void> {
    const hasBookmarkData = async (): Promise<boolean> => {
      const sample = await bookmarkAppService.hasBookmarkData()
      return sample.ok && sample.value === true
    }

    if (await hasBookmarkData()) {
      return
    }

    logger.debug('PopupStore', '书签库尚未就绪，等待 Background 同步')

    await new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' }, response => {
        const chromeLastError = chrome.runtime.lastError
        if (chromeLastError) {
          reject(new Error(chromeLastError.message))
          return
        }

        if (response && typeof response === 'object' && 'ok' in response && response.ok === false) {
          const message =
            'error' in response && typeof response.error === 'string'
              ? response.error
              : '全量同步失败'
          reject(new Error(message))
          return
        }

        resolve()
      })
    })

    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      if (await hasBookmarkData()) {
        return
      }
      await new Promise<void>(resolve => setTimeout(resolve, 150))
    }

    throw new Error('书签数据同步超时，请稍后重试')
  }

  /**
   * 初始化弹窗
   *
   * @description
   * 加载当前标签页信息、统计数据，并记录性能耗时。
   */
  async function initialize(): Promise<void> {
    const startTime = performance.now()
    isLoading.value = true
    lastError.value = null

    try {
      logger.info('PopupStore', '初始化 Popup Store (IndexedDB版本) ...')

      // 1. 初始化统一API (自动完成)
      // 统一API自动初始化

      // 2. 确保书签数据已同步（扩展重载后 IndexedDB 可能尚未写入）
      await ensureBookmarkDataReady()

      // 3. 获取当前标签页信息
      await getCurrentTab()

      // 4. 加载书签统计
      await loadBookmarkStats()

      // 5. 数据更新监听 (新架构中由Service Worker处理)

      logger.info('PopupStore', '初始化完成')
    } catch (error) {
      lastError.value = `初始化失败: ${(error as Error).message}`
      logger.error('PopupStore', '初始化失败', error)
      throw error
    } finally {
      isLoading.value = false
      const endTime = performance.now()
      logger.info('PopupStore', `初始化耗时: ${(endTime - startTime).toFixed(2)}ms`)
    }
  }

  /**
   * 获取当前标签页信息
   *
   * @description
   * 尝试读取正在活动的标签页 ID、URL、标题，用于后续跳转。
   */
  async function getCurrentTab(): Promise<void> {
    try {
      const result = await tabBrowserAppService.getCurrentActiveTab()
      if (result.ok && result.value) {
        currentTabId.value = result.value.id
        currentTabUrl.value = result.value.url
        currentTabTitle.value = result.value.title
      }
    } catch (error) {
      logger.warn('PopupStore', '获取当前标签页失败', error)
    }
  }

  /**
   * 加载书签统计
   *
   * @description
   * 调用应用服务获取总书签数量，并写入响应式状态。
   * 数据更新由 background service worker 的广播机制自动触发，无需手动检查过期。
   */
  async function loadBookmarkStats(): Promise<void> {
    try {
      const result = await bookmarkAppService.getBookmarkSummaryStats()
      if (!result.ok || !result.value) {
        logger.warn('PopupStore', '加载书签统计失败', result.ok ? undefined : result.error)
        return
      }

      stats.value = result.value

      logger.info('PopupStore', '📊 统计数据已更新', stats.value)
    } catch (error) {
      logger.warn('PopupStore', '加载书签统计失败', error)
    }
  }

  /**
   * 自动刷新统计数据
   *
   * @description
   * 当书签数据更新时自动触发，确保 UI 显示最新数据
   *
   * 注意：特征数据由 TraitDataStore 自动刷新，无需在此处理
   */
  async function autoRefreshData(): Promise<void> {
    try {
      logger.info('PopupStore', '🔄 自动刷新数据...')

      // 只刷新书签统计，特征数据由 TraitDataStore 自动处理
      await loadBookmarkStats()

      logger.info('PopupStore', '✅ 自动刷新完成')
    } catch (error) {
      logger.error('PopupStore', '❌ 自动刷新失败:', error)
    }
  }

  /**
   * 监听书签数据同步消息，自动刷新统计数据
   *
   * @description
   * 监听 background service worker 广播的书签同步完成消息，
   * 自动刷新 UI 数据，无需用户手动操作
   *
   * 注意：特征更新消息由 TraitDataStore 自动监听，无需在此处理
   */
  function setupAutoRefreshListener(): void {
    chrome.runtime.onMessage.addListener(message => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) return
      // 监听书签同步完成消息
      if (message.type === 'yiveno-db-synced') {
        logger.info('PopupStore', `📡 收到书签同步消息 (${message.eventType})，自动刷新数据`)

        // 使用 queueMicrotask 避免阻塞消息处理
        queueMicrotask(async () => {
          void autoRefreshData()
          // 清除 Worker 适配器的缓存，确保搜索使用最新数据
          const { queryWorkerAdapter } =
            await import('@/infrastructure/services/query-worker-adapter')
          queryWorkerAdapter.clearCache()
        })
      }
    })

    logger.info('PopupStore', '✅ 自动刷新监听器已设置')
  }

  // 初始化时设置自动刷新监听器
  setupAutoRefreshListener()

  /**
   * 打开书签
   *
   * @param bookmark 需要打开的书签信息
   * @param inNewTab 是否在新标签页中打开
   */
  async function openBookmark(
    bookmark: { id?: string; url?: string; domain?: string },
    inNewTab: boolean = false
  ): Promise<void> {
    if (!bookmark.url) return

    try {
      if (inNewTab) {
        await tabBrowserAppService.openUrlInNewTab(bookmark.url)
      } else {
        await tabBrowserAppService.openUrlInActiveTab(bookmark.url)
      }

      // 2. 记录访问（如果有 bookmarkId）
      if (bookmark.id) {
        try {
          const result = await bookmarkAppService.updateVisitRecord(bookmark.id)
          if (!result.ok) {
            logger.warn('PopupStore', '⚠️ 更新访问记录失败', result.error)
          } else {
            logger.debug('PopupStore', '✅ 访问记录已更新', {
              id: bookmark.id
            })
          }
        } catch (error) {
          logger.warn('PopupStore', '更新访问记录失败', error)
          // 不影响打开书签的操作
        }
      }

      logger.info('PopupStore', '📊 书签已打开', {
        inNewTab,
        fromSearch: true,
        domain: bookmark.domain,
        recordedVisit: !!bookmark.id
      })
    } catch (error) {
      logger.error('PopupStore', '打开书签失败:', error)
    }
  }

  /**
   * 获取数据库信息（用于调试）
   *
   * @returns 书签数量等调试数据
   */
  async function getDatabaseInfo(): Promise<{
    bookmarkCount: number
    settingsCount: number
    estimatedSize: number
  }> {
    // 数据库信息现在通过统一API获取
    const res = await bookmarkAppService.getAllBookmarks()
    return {
      bookmarkCount: res.ok ? res.value?.filter(b => !!b.url).length || 0 : 0,
      settingsCount: 0, // 暂时设为0
      estimatedSize: 0 // 暂时设为0，可以后续实现
    }
  }

  // ==================== 监听器设置 ====================

  // ==================== 返回公共接口 ====================

  return {
    // 状态
    isLoading,
    lastError,
    currentTabUrl,
    currentTabTitle,
    currentTabId,
    stats,

    // 计算属性
    hasCurrentTab,
    totalItems,

    // 方法
    initialize,
    getCurrentTab,
    loadBookmarkStats,
    openBookmark,
    getDatabaseInfo
  }
})
