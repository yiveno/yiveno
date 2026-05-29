import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useBookmarkStore } from '@/stores/bookmark-tree-store'
import type { BookmarkNode } from '../types'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { message } from '@/application/message/message-service'
import { scheduleUIUpdate } from '@/application/scheduler/scheduler-service'
import { useThemeSync } from '@/composables/useThemeSync'

type ShareType = 'favorites' | 'folder' | 'bookmark'
type OpenableBookmark = BookmarkNode | { id: string; url: string | undefined; title: string }

const INTERNAL_PROTOCOLS = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'file://',
  'edge://',
  'brave://'
]

/** SidePanel 页面逻辑封装。 */
export function useSidePanelPage() {
  useThemeSync('SidePanel')
  const bookmarkStore = useBookmarkStore()
  const { bookmarkTree } = storeToRefs(bookmarkStore)

  // ========== State ==========
  const treeSelectedDescCounts = shallowRef(new Map<string, number>())
  const isLoading = ref(true)
  const treeRefreshKey = ref(0)
  const searchQuery = ref('')
  const recentCount = ref(0)
  const showShareDialog = ref(false)
  const shareBookmarks = ref<BookmarkNode[]>([])
  const shareType = ref<ShareType>('favorites')
  const shareFolderName = ref<string>()
  const showUpdatePrompt = ref(false)
  const pendingUpdateDetail = ref<{ eventType: string; id: string } | null>(null)
  const favoriteCount = computed(() => bookmarkStore.favoriteBookmarks.length)
  let cleanupSyncRef: (() => void) | null = null

  // ========== Helpers ==========
  async function updateVisitRecord(bookmarkId: string) {
    try {
      const { bookmarkAppService } = await import('@/application/bookmark/bookmark-app-service')
      const result = await bookmarkAppService.updateVisitRecord(bookmarkId)
      if (!result.ok) logger.warn('SidePanel', '更新访问记录失败', result.error)
    } catch (error) {
      logger.warn('SidePanel', '更新访问记录失败', error)
    }
  }

  function isInternalUrl(url: string): boolean {
    const l = url.toLowerCase()
    return INTERNAL_PROTOCOLS.some(p => l.startsWith(p))
  }

  function openShareDialog(bookmarks: BookmarkNode[], type: ShareType, folderName?: string) {
    shareBookmarks.value = bookmarks
    shareType.value = type
    shareFolderName.value = folderName
    showShareDialog.value = true
  }

  /** BFS 收集文件夹下所有书签，避免递归栈溢出。 */
  function collectFolderBookmarks(folder: BookmarkNode): BookmarkNode[] {
    const result: BookmarkNode[] = []
    const queue: BookmarkNode[] = [folder]
    const visited = new Set<string>()
    let depth = 0
    while (queue.length && depth <= 50) {
      const node = queue.shift()!
      if (visited.has(node.id)) continue
      visited.add(node.id)
      for (const child of node.children || []) {
        if (child.url) result.push(child)
        else if (child.children) queue.push(child)
      }
      depth++
    }
    return result
  }

  // ========== Search & Bookmark ==========
  function handleSearchComplete() {
    logger.info('SidePanel', '搜索完成')
  }
  function handleSearchClear() {
    searchQuery.value = ''
  }

  async function openBookmark(b: OpenableBookmark) {
    if (!b.url) return
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (tabs[0]?.id) await chrome.tabs.update(tabs[0].id, { url: b.url })
      else await chrome.tabs.create({ url: b.url, active: true })
      await updateVisitRecord(b.id)
    } catch {
      if (typeof window !== 'undefined') window.open(b.url, '_blank')
      message.info('打开书签失败，请重试')
    }
  }

  async function handleBookmarkClick(node: BookmarkNode) {
    if (node.url) await updateVisitRecord(node.id)
  }

  function handleFolderToggle() {}

  // ========== Event handlers ==========
  async function handleRecentClick(b: BookmarkRecord) {
    await openBookmark({ id: b.id, url: b.url, title: b.title || '' })
  }
  function handleRecentRemove(b: { title?: string }) {
    message.info(`已清除访问记录：${b.title || '未知书签'}`)
  }

  async function handleFavoriteClick(b: BookmarkNode) {
    await openBookmark(b)
  }
  function handleFavoriteRemove(b: { title?: string }) {
    message.info(`已取消收藏：${b.title || '未知书签'}`)
  }

  function handleShareFavorites(bookmarks: BookmarkNode[]) {
    openShareDialog(bookmarks, 'favorites')
  }
  function handleFolderShare(folder: BookmarkNode) {
    openShareDialog(collectFolderBookmarks(folder), 'folder', folder.title)
  }
  function handleBookmarkShare(bookmark: BookmarkNode) {
    openShareDialog([bookmark], 'bookmark', bookmark.title)
  }
  function handleShareComplete() {
    showShareDialog.value = false
  }

  async function handleBookmarkToggleFavorite(node: BookmarkNode, isFavorite: boolean) {
    try {
      const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')
      const ok = isFavorite
        ? await favoriteAppService.addToFavorites(node.id)
        : await favoriteAppService.removeFromFavorites(node.id)
      if (ok) message.info(isFavorite ? '书签已收藏' : '已取消收藏')
    } catch {
      message.error('收藏操作失败，请重试')
    }
  }

  async function handleBookmarkOpenNewTab(node: BookmarkNode) {
    if (!node.url) return
    if (isInternalUrl(node.url)) {
      message.error('无法打开内部链接')
      return
    }
    if (typeof window === 'undefined' || !window?.open) {
      message.error('当前环境不支持')
      return
    }
    const w = window.open(node.url, '_blank')
    if (!w || w.closed) {
      message.warning('链接被浏览器阻止')
      return
    }
    await updateVisitRecord(node.id)
  }

  function handleBookmarkCopyUrl() {
    message.success('书签链接已复制')
  }
  function handleTreeReady() {
    isLoading.value = false
  }

  // ========== Lifecycle ==========
  function setupRealtimeSync(): () => void {
    const u1 = onEvent('bookmark:updated', data =>
      scheduleUIUpdate(
        () => {
          pendingUpdateDetail.value = { eventType: 'updated', id: data.id }
          showUpdatePrompt.value = true
        },
        { timeoutMs: 150 }
      )
    )

    const u2 = onEvent('data:synced', () => scheduleUIUpdate(() => {}, { timeoutMs: 150 }))

    const u3 = onEvent('bookmark:visited', async () => {
      try {
        const visits = await indexedDBManager.getRecentVisits(5)
        scheduleUIUpdate(
          () => {
            recentCount.value = visits.length
          },
          { timeoutMs: 150 }
        )
      } catch (error) {
        logger.error('SidePanel', '更新最近访问失败', error)
      }
    })

    return () => {
      u1()
      u2()
      u3()
    }
  }

  async function initialize() {
    try {
      isLoading.value = true
      await bookmarkStore.loadFromIndexedDB()
      const visits = await indexedDBManager.getRecentVisits(5)
      recentCount.value = visits.length
      cleanupSyncRef = setupRealtimeSync()
    } catch (error) {
      logger.error('SidePanel', '初始化失败', error)
    } finally {
      isLoading.value = false
    }
  }

  async function confirmRefresh() {
    showUpdatePrompt.value = false
    isLoading.value = true
    treeRefreshKey.value += 1
  }

  function postponeRefresh() {
    showUpdatePrompt.value = false
  }

  onMounted(() => {
    initialize()
  })
  onUnmounted(() => {
    if (cleanupSyncRef) {
      try {
        cleanupSyncRef()
      } catch (error) {
        logger.error('SidePanel', '清理监听器失败', error)
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
