import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import type { BookmarkNode, BookmarkUpdateDetail } from '../types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { message } from '@/application/message/message-service'
import { scheduleUIUpdate, scheduleMicrotask } from '@/application/scheduler/scheduler-service'
import { useThemeSync } from '@/composables/useThemeSync'

type SidePanelShareType = 'favorites' | 'folder' | 'bookmark'
type OpenableBookmark =
  | BookmarkNode
  | {
      id: string
      url: string | undefined
      title: string
    }

const INTERNAL_PROTOCOL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'file://',
  'edge://',
  'brave://'
] as const

/**
 * SidePanel 页面逻辑封装，减少根组件体积并集中管理初始化与事件处理。
 */
export function useSidePanelPage() {
  useThemeSync('SidePanel')

  const bookmarkStore = useBookmarkStore()
  const { bookmarkTree } = storeToRefs(bookmarkStore)

  const treeSelectedDescCounts = shallowRef(new Map<string, number>())
  const isLoading = ref(true)
  const treeRefreshKey = ref(0)
  const searchQuery = ref('')
  const recentCount = ref(0)
  const showShareDialog = ref(false)
  const shareBookmarks = ref<BookmarkNode[]>([])
  const shareType = ref<SidePanelShareType>('favorites')
  const shareFolderName = ref<string | undefined>(undefined)
  const showUpdatePrompt = ref(false)
  const pendingUpdateDetail = ref<BookmarkUpdateDetail | null>(null)

  const favoriteCount = computed(() => bookmarkStore.favoriteBookmarks.length)

  let cleanupSyncRef: (() => void) | null = null

  /**
   * 打开书签链接时统一更新访问记录。
   */
  async function updateBookmarkVisitRecord(bookmarkId: string): Promise<void> {
    try {
      const { bookmarkAppService } = await import('@/application/bookmark/bookmark-app-service')

      const result = await bookmarkAppService.updateVisitRecord(bookmarkId)
      if (!result.ok) {
        logger.warn('SidePanel', '⚠️ 更新访问记录失败', result.error)
      }
    } catch (error) {
      logger.warn('SidePanel', '⚠️ 更新访问记录失败', error)
    }
  }

  /**
   * 判断是否为浏览器内部协议链接。
   */
  function isInternalProtocolUrl(url: string): boolean {
    if (!url) return false

    const lowerUrl = url.toLowerCase()
    return INTERNAL_PROTOCOL_PREFIXES.some(prefix => lowerUrl.startsWith(prefix))
  }

  /**
   * 处理搜索完成事件。
   */
  function handleSearchComplete(_results: BookmarkNode[]): void {
    logger.info('SidePanel', '搜索完成')
  }

  /**
   * 处理搜索清空事件。
   */
  function handleSearchClear(): void {
    searchQuery.value = ''
    logger.info('SidePanel', '搜索已清空')
  }

  /**
   * 打开书签。
   */
  async function openBookmark(bookmark: OpenableBookmark): Promise<void> {
    if (!bookmark.url) return

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      })

      if (tabs[0]?.id) {
        await chrome.tabs.update(tabs[0].id, { url: bookmark.url })
      } else {
        await chrome.tabs.create({ url: bookmark.url, active: true })
      }

      await updateBookmarkVisitRecord(bookmark.id)
    } catch (error) {
      logger.error('SidePanel', '打开书签失败', error)

      if (typeof window !== 'undefined') {
        window.open(bookmark.url, '_blank')
      }

      message.info('打开书签失败，请重试')
    }
  }

  /**
   * 处理书签点击。
   */
  async function handleBookmarkClick(bookmark: BookmarkNode, _event: MouseEvent): Promise<void> {
    if (!bookmark.url) return

    logger.debug('SidePanel', '书签已打开，更新访问记录', {
      title: bookmark.title,
      url: bookmark.url
    })

    await updateBookmarkVisitRecord(bookmark.id)
  }

  /**
   * 处理文件夹展开/收起。
   */
  function handleFolderToggle(folderId: string, node: BookmarkNode, expanded: boolean): void {
    logger.debug('SidePanel', '📂 文件夹状态变化', {
      folderId,
      title: node.title,
      expanded
    })
  }

  /**
   * 处理最近访问点击。
   */
  async function handleRecentClick(bookmark: BookmarkRecord): Promise<void> {
    logger.info('SidePanel', '🕐 点击最近访问:', bookmark.title)
    await openBookmark({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title || ''
    })
  }

  /**
   * 处理最近访问清除。
   */
  function handleRecentRemove(bookmark: BookmarkRecord): void {
    logger.info('SidePanel', '🗑️ 清除最近访问记录:', bookmark.title)
    message.info(`已清除访问记录: ${bookmark.title}`)
  }

  /**
   * 处理收藏书签点击。
   */
  async function handleFavoriteClick(bookmark: BookmarkNode): Promise<void> {
    logger.info('SidePanel', '⭐ 点击收藏书签:', bookmark.title)
    await openBookmark(bookmark)
  }

  /**
   * 处理收藏书签移除。
   */
  function handleFavoriteRemove(bookmark: BookmarkNode): void {
    logger.info('SidePanel', '🗑️ 移除收藏书签:', bookmark.title)
    message.info(`已取消收藏: ${bookmark.title}`)
  }

  /**
   * 将文件夹中的书签收集到扁平列表。
   */
  function collectBookmarksFromFolder(
    folder: BookmarkNode,
    visited: Set<string> = new Set(),
    depth: number = 0,
    maxDepth: number = 50
  ): BookmarkNode[] {
    const bookmarks: BookmarkNode[] = []

    if (depth > maxDepth) {
      logger.warn('SidePanel', '⚠️ 递归深度超过限制，停止收集', {
        depth,
        folderId: folder.id
      })
      return bookmarks
    }

    if (visited.has(folder.id)) {
      logger.warn('SidePanel', '⚠️ 检测到循环引用，跳过文件夹', {
        folderId: folder.id
      })
      return bookmarks
    }

    visited.add(folder.id)

    if (!folder.children) {
      return bookmarks
    }

    for (const child of folder.children) {
      if (child.url) {
        bookmarks.push(child)
      } else if (child.children) {
        bookmarks.push(...collectBookmarksFromFolder(child, visited, depth + 1, maxDepth))
      }
    }

    return bookmarks
  }

  /**
   * 统一设置分享弹窗状态。
   */
  function openShareDialog(
    bookmarks: BookmarkNode[],
    type: SidePanelShareType,
    folderName?: string
  ): void {
    shareBookmarks.value = bookmarks
    shareType.value = type
    shareFolderName.value = folderName
    showShareDialog.value = true
  }

  /**
   * 处理分享收藏书签。
   */
  function handleShareFavorites(bookmarks: BookmarkNode[]): void {
    logger.info('SidePanel', `📤 分享 ${bookmarks.length} 个收藏书签`)
    openShareDialog(bookmarks, 'favorites')
  }

  /**
   * 处理分享文件夹。
   */
  function handleFolderShare(folder: BookmarkNode): void {
    const bookmarks = collectBookmarksFromFolder(folder)
    logger.info('SidePanel', `📤 分享文件夹: ${folder.title}，包含 ${bookmarks.length} 个书签`)
    openShareDialog(bookmarks, 'folder', folder.title)
  }

  /**
   * 处理分享书签。
   */
  function handleBookmarkShare(bookmark: BookmarkNode): void {
    logger.info('SidePanel', `📤 分享书签: ${bookmark.title}`)
    openShareDialog([bookmark], 'bookmark', bookmark.title)
  }

  /**
   * 处理分享完成。
   */
  function handleShareComplete(): void {
    logger.info('SidePanel', '✅ 分享完成')
    showShareDialog.value = false
  }

  /**
   * 切换收藏状态。
   */
  async function handleBookmarkToggleFavorite(
    node: BookmarkNode,
    isFavorite: boolean
  ): Promise<void> {
    logger.info('SidePanel', `${isFavorite ? '⭐ 收藏' : '🗑️ 取消收藏'}书签:`, node.title)

    try {
      const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')

      const success = isFavorite
        ? await favoriteAppService.addToFavorites(node.id)
        : await favoriteAppService.removeFromFavorites(node.id)

      if (!success) {
        logger.debug('SidePanel', '操作被取消或失败')
        return
      }

      message.info(isFavorite ? '书签已收藏' : '已取消收藏')
      bookmarkStore.updateNode(node.id, { isFavorite })
      logger.debug('SidePanel', '✅ 书签收藏状态已更新')
    } catch (error) {
      logger.error('Component', 'SidePanel', '❌ 切换收藏状态失败:', error)
      message.error('操作失败，请重试')
    }
  }

  /**
   * 打开新标签页。
   */
  async function handleBookmarkOpenNewTab(node: BookmarkNode): Promise<void> {
    logger.info('SidePanel', '📂 在新标签页打开', node.title, node.url)

    if (!node.url) {
      message.warning('该书签没有有效的 URL')
      return
    }

    const hasInternalTag = node.traitTags?.includes('internal')
    const isInternalUrl = isInternalProtocolUrl(node.url)

    if (hasInternalTag || isInternalUrl) {
      message.warning('无法在新标签页打开浏览器内部链接')
      logger.warn('SidePanel', '尝试打开内部协议书签:', node.url)
      return
    }

    try {
      if (typeof window === 'undefined') {
        logger.error('SidePanel', '非浏览器环境，无法打开链接')
        message.error('当前环境不支持打开链接')
        return
      }

      const newWindow = window.open(node.url, '_blank')
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        message.warning('链接被浏览器阻止，请检查弹窗设置')
        logger.warn('SidePanel', '链接被浏览器阻止:', node.url)
        return
      }

      await updateBookmarkVisitRecord(node.id)
    } catch (error) {
      message.error('打开链接失败')
      logger.error('SidePanel', '打开链接失败:', error, node.url)
    }
  }

  /**
   * 复制书签 URL。
   */
  function handleBookmarkCopyUrl(node: BookmarkNode): void {
    logger.info('SidePanel', '📋 复制URL成功', node.title, node.url)

    try {
      message.success('书签链接已复制')
    } catch {
      logger.info('SidePanel', '✅ URL已复制到剪贴板', node.url)
    }
  }

  /**
   * 组件就绪。
   */
  function handleTreeReady(): void {
    isLoading.value = false
    logger.info('SidePanel', '📱 书签树组件就绪，数据加载完成')
  }

  /**
   * 处理实时同步监听。
   */
  function setupRealtimeSync(): () => void {
    const unsubscribeUpdate = onEvent('bookmark:updated', data => {
      logger.info('SidePanel', '🔄 收到书签更新事件', data)
      scheduleUIUpdate(
        () => {
          pendingUpdateDetail.value = {
            eventType: 'updated',
            id: data.id,
            changes: data.changes
          }
          showUpdatePrompt.value = true
        },
        { timeoutMs: 150 }
      )
    })

    const unsubscribeSync = onEvent('data:synced', () => {
      scheduleUIUpdate(
        () => {
          logger.info('SidePanel', '🟢 DB 同步完成')
        },
        { timeoutMs: 150 }
      )
    })

    const unsubscribeVisited = onEvent('bookmark:visited', async () => {
      try {
        const recentVisits = await indexedDBManager.getRecentVisits(5)
        scheduleUIUpdate(
          () => {
            recentCount.value = recentVisits.length
            logger.debug('SidePanel', '🔄 书签访问事件：更新最近访问数量', recentCount.value)
          },
          { timeoutMs: 150 }
        )
      } catch (error) {
        logger.error('SidePanel', '❌ 更新最近访问数量失败', error)
      }
    })

    return () => {
      unsubscribeUpdate()
      unsubscribeSync()
      unsubscribeVisited()
    }
  }

  /**
   * 通过 IDB 读取初始统计。
   */
  async function initializeInitialStats(): Promise<void> {
    try {
      const recentVisits = await indexedDBManager.getRecentVisits(5)
      recentCount.value = recentVisits.length

      logger.info('SidePanel', '📊 统计数据初始化完成', {
        recent: recentCount.value,
        favorites: favoriteCount.value
      })
    } catch (error) {
      logger.warn('SidePanel', '⚠️ 统计数据初始化失败', error)
    }
  }

  /**
   * 初始化页面。
   */
  async function initializeSidePanel(): Promise<void> {
    try {
      logger.info('SidePanel', '🚀 SidePanel开始初始化...')
      isLoading.value = true

      try {
        await bookmarkStore.loadFromIndexedDB()
        logger.info('SidePanel', '✅ 书签数据加载完成')
        await initializeInitialStats()
      } catch (error) {
        logger.error('Component', 'SidePanel', '❌ 书签数据加载失败:', error)
      } finally {
        isLoading.value = false
      }

      cleanupSyncRef = setupRealtimeSync()
      logger.info('SidePanel', '🎉 SidePanel初始化完成！')
    } catch (error) {
      logger.error('Component', 'SidePanel', '❌ SidePanel初始化失败:', error)
      isLoading.value = false
    }
  }

  /**
   * 确认刷新。
   */
  async function confirmRefresh(): Promise<void> {
    try {
      scheduleMicrotask(() => {
        showUpdatePrompt.value = false
      })

      scheduleUIUpdate(
        () => {
          isLoading.value = true
          treeRefreshKey.value += 1
          logger.info('SidePanel', '✅ 已刷新侧边栏数据')
        },
        { timeoutMs: 100 }
      )
    } catch (error) {
      logger.error('SidePanel', '❌ 刷新失败', error)
      isLoading.value = false
    }
  }

  /**
   * 暂缓刷新。
   */
  function postponeRefresh(): void {
    showUpdatePrompt.value = false
    logger.info('SidePanel', '⏸️ 已暂缓刷新侧边栏数据')
  }

  onMounted(() => {
    void initializeSidePanel()
  })

  onUnmounted(() => {
    if (cleanupSyncRef) {
      try {
        cleanupSyncRef()
      } catch (error) {
        logger.error('SidePanel', '❌ 清理监听器失败', error)
      } finally {
        cleanupSyncRef = null
      }
    }

    isLoading.value = false
  })

  return {
    bookmarkTree,
    treeSelectedDescCounts,
    isLoading,
    treeRefreshKey,
    searchQuery,
    recentCount,
    favoriteCount,
    showShareDialog,
    shareBookmarks,
    shareType,
    shareFolderName,
    showUpdatePrompt,
    pendingUpdateDetail,
    handleSearchComplete,
    handleSearchClear,
    openBookmark,
    handleBookmarkClick,
    handleFolderToggle,
    handleRecentClick,
    handleRecentRemove,
    handleFavoriteClick,
    handleFavoriteRemove,
    handleShareFavorites,
    handleFolderShare,
    handleBookmarkShare,
    handleShareComplete,
    handleBookmarkToggleFavorite,
    handleBookmarkOpenNewTab,
    handleBookmarkCopyUrl,
    handleTreeReady,
    confirmRefresh,
    postponeRefresh
  }
}
