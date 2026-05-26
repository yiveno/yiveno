<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'

defineOptions({
  name: 'SidePanelPage'
})
import { Accordion, AccordionItem, Dialog, AppHeader } from '@/components'
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import { FavoriteSection, RecentVisits } from './components'
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
import ShareDialog from '@/components/business/ShareDialog/ShareDialog.vue'
import BookmarkSearchInput from '@/components/business/BookmarkSearchInput/BookmarkSearchInput.vue'

import { useBookmarkStore } from '@/stores/bookmarkStore'
import type { BookmarkNode, BookmarkUpdateDetail } from './types'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { message } from '@/application/message/message-service'
import { scheduleUIUpdate, scheduleMicrotask } from '@/application/scheduler/scheduler-service'
import { useThemeSync } from '@/composables/useThemeSync'
import { t } from '@/utils/i18n-helpers'

// 启用主题同步
useThemeSync('SidePanel')

// ==================== Store ====================
const bookmarkStore = useBookmarkStore()
const { bookmarkTree } = storeToRefs(bookmarkStore)

// ✅ SimpleBookmarkTree 必需的 props（纯 UI 组件）
const treeSelectedDescCounts = shallowRef(new Map<string, number>())

/**
 * 响应式状态
 * @description 响应式状态
 * @returns {boolean} 是否加载中
 * @throws {Error} 响应式状态失败
 */
const isLoading = ref(true)
/**
 * 通过切换 key 触发组件重挂载，达到刷新内部数据的目的
 * @description 通过切换 key 触发组件重挂载，达到刷新内部数据的目的
 * @returns {number} 刷新键
 * @throws {Error} 通过切换 key 触发组件重挂载，达到刷新内部数据的目的失败
 */
const treeRefreshKey = ref(0)

// ✅ 展开状态由 BookmarkTree 组件内部管理，SidePanel 不需要维护
/**
 * 搜索查询（用于控制 Accordion 显示/隐藏）
 * @description 搜索查询
 * @returns {string} 搜索查询
 * @throws {Error} 搜索查询失败
 */
const searchQuery = ref('')

/**
 * 搜索结果（由 BookmarkSearchInput 组件管理）
 */
const searchResults = ref<BookmarkNode[]>([])

/**
 * 最近访问数量
 */
const recentCount = ref(0)

/**
 * 收藏书签数量 - 直接从 store 计算，实时响应变化
 */
const favoriteCount = computed(() => bookmarkStore.favoriteBookmarks.length)

// ==================== 分享功能状态 ====================
/**
 * 是否显示分享弹窗
 */
const showShareDialog = ref(false)

/**
 * 要分享的书签列表
 */
const shareBookmarks = ref<BookmarkNode[]>([])

/**
 * 分享类型
 */
const shareType = ref<'favorites' | 'folder' | 'bookmark'>('favorites')

/**
 * 分享的文件夹名称（分享文件夹时使用）
 */
const shareFolderName = ref<string | undefined>(undefined)

/**
 * 处理搜索完成事件
 * @param {BookmarkNode[]} results 搜索结果
 */
const handleSearchComplete = (results: BookmarkNode[]) => {
  searchResults.value = results
  logger.info('SidePanel', '搜索完成', { resultCount: results.length })
}

/**
 * 处理搜索清空事件
 */
const handleSearchClear = () => {
  searchResults.value = []
  searchQuery.value = ''
  logger.info('SidePanel', '搜索已清空')
}

/**
 * 更新书签访问记录
 * @description 通过 application 层服务更新书签的 lastVisited 和 visitCount 字段
 * @param {string} bookmarkId 书签ID
 * @returns {Promise<void>}
 */
const updateBookmarkVisitRecord = async (bookmarkId: string) => {
  try {
    // ✅ 正确：通过 application 层服务访问
    const { bookmarkAppService } = await import('@/application/bookmark/bookmark-app-service')

    const result = await bookmarkAppService.updateVisitRecord(bookmarkId)

    if (!result.ok) {
      logger.warn('SidePanel', '⚠️ 更新访问记录失败', result.error)
    }
  } catch (error) {
    logger.warn('SidePanel', '⚠️ 更新访问记录失败', error)
    // 不影响主流程
  }
}

/**
 * 处理书签点击（来自 BookmarkTree 组件）
 * @description BookmarkTree 组件已经处理了打开逻辑，这里只更新访问记录
 * @param {BookmarkNode} bookmark 书签节点
 * @param {MouseEvent} _event 鼠标事件（未使用）
 * @returns {void}
 */
const handleBookmarkClick = async (bookmark: BookmarkNode, _event: MouseEvent) => {
  // 只处理书签（有 URL 的节点）
  if (!bookmark.url) return

  logger.debug('SidePanel', '书签已打开，更新访问记录', {
    title: bookmark.title,
    url: bookmark.url
  })

  // 更新访问记录
  await updateBookmarkVisitRecord(bookmark.id)
}

/**
 * 打开书签（用于搜索结果等非 BookmarkTree 场景）
 * @description 在当前标签页打开书签
 * @param {BookmarkNode | { id: string; url?: string; title: string }} bookmark 书签
 * @returns {void}
 */
const openBookmark = async (
  bookmark: BookmarkNode | { id: string; url?: string; title: string }
) => {
  if (!bookmark.url) return

  try {
    // 在当前标签页打开
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    })

    if (tabs[0]?.id) {
      await chrome.tabs.update(tabs[0].id, { url: bookmark.url })
      await updateBookmarkVisitRecord(bookmark.id)
    } else {
      // 降级：创建新标签页
      await chrome.tabs.create({ url: bookmark.url, active: true })
      await updateBookmarkVisitRecord(bookmark.id)
    }
  } catch (error) {
    logger.error('SidePanel', '打开书签失败', error)
    message.info('打开书签失败，请重试')
  }
}

/**
 * 处理文件夹展开/收起
 * @description 接收 BookmarkTree 的展开状态变化通知（仅用于日志记录）
 * @param {string} folderId 文件夹ID
 * @param {BookmarkNode} node 文件夹节点
 * @param {boolean} expanded 是否展开
 * @returns {void} 处理文件夹展开/收起
 */
const handleFolderToggle = (folderId: string, node: BookmarkNode, expanded: boolean) => {
  // ✅ 展开状态由 BookmarkTree 内部管理，这里只记录日志
  logger.debug('SidePanel', '📂 文件夹状态变化', {
    folderId,
    title: node.title,
    expanded
  })
}

/**
 * 处理最近访问点击
 * @description 最近访问书签被点击时的回调
 * @param {BookmarkRecord} bookmark 被点击的书签
 * @returns {void} 无返回值
 */
const handleRecentClick = async (bookmark: BookmarkRecord) => {
  logger.info('SidePanel', '🕐 点击最近访问:', bookmark.title)

  // 转换为 BookmarkNode 格式并打开
  await openBookmark({
    id: bookmark.id,
    url: bookmark.url,
    title: bookmark.title || ''
  })
}

/**
 * 处理最近访问记录清除
 * @description 最近访问记录被清除时的回调
 * @param {BookmarkRecord} bookmark 被清除的书签
 * @returns {void} 无返回值
 */
const handleRecentRemove = (bookmark: BookmarkRecord) => {
  logger.info('SidePanel', '🗑️ 清除最近访问记录:', bookmark.title)
  message.info(`已清除访问记录: ${bookmark.title}`)
}

/**
 * 处理收藏书签点击
 * @description 在当前标签页打开收藏的书签
 * @param {BookmarkNode} bookmark 收藏书签
 * @returns {void} 无返回值
 */
const handleFavoriteClick = async (bookmark: BookmarkNode) => {
  logger.info('SidePanel', '⭐ 点击收藏书签:', bookmark.title)

  // ✅ 打开收藏的书签
  await openBookmark(bookmark)
}

/**
 * 处理收藏书签移除
 * @description 收藏书签被移除时的回调（FavoriteSection 已处理 store 更新）
 * @param {BookmarkNode} bookmark 被移除的收藏书签
 * @returns {void} 无返回值
 */
const handleFavoriteRemove = (bookmark: BookmarkNode) => {
  logger.info('SidePanel', '🗑️ 移除收藏书签:', bookmark.title)
  message.info(`已取消收藏: ${bookmark.title}`)
  // FavoriteSection 已在内部调用 bookmarkStore.updateNode
}

/**
 * 处理分享收藏书签
 * @description 打开分享弹窗，生成分享海报
 * @param {BookmarkNode[]} bookmarks 收藏书签列表
 * @returns {void} 无返回值
 */
const handleShareFavorites = (bookmarks: BookmarkNode[]) => {
  logger.info('SidePanel', `📤 分享 ${bookmarks.length} 个收藏书签`)

  // 设置分享数据
  shareBookmarks.value = bookmarks
  shareType.value = 'favorites'
  shareFolderName.value = undefined

  // 打开分享弹窗
  showShareDialog.value = true
}

/**
 * 处理分享文件夹
 * @description 打开分享弹窗，生成分享海报
 * @param {BookmarkNode} folder 文件夹节点
 * @returns {void} 无返回值
 */
const handleFolderShare = (folder: BookmarkNode) => {
  // 递归收集文件夹中的所有书签
  const bookmarks = collectBookmarksFromFolder(folder)

  logger.info('SidePanel', `📤 分享文件夹: ${folder.title}，包含 ${bookmarks.length} 个书签`)

  // 设置分享数据
  shareBookmarks.value = bookmarks
  shareType.value = 'folder'
  shareFolderName.value = folder.title

  // 打开分享弹窗
  showShareDialog.value = true
}

/**
 * 处理分享书签
 * @description 打开分享弹窗，分享单个书签
 * @param {BookmarkNode} bookmark 书签节点
 * @returns {void} 无返回值
 */
const handleBookmarkShare = (bookmark: BookmarkNode) => {
  logger.info('SidePanel', `📤 分享书签: ${bookmark.title}`)

  // 设置分享数据
  shareBookmarks.value = [bookmark]
  shareType.value = 'bookmark'
  shareFolderName.value = bookmark.title

  // 打开分享弹窗
  showShareDialog.value = true
}

/**
 * 递归收集文件夹中的所有书签
 * @param {BookmarkNode} folder 文件夹节点
 * @param {Set<string>} visited 已访问的节点ID集合（防止循环引用）
 * @param {number} depth 当前递归深度
 * @param {number} maxDepth 最大递归深度
 * @returns {BookmarkNode[]} 书签列表
 */
const collectBookmarksFromFolder = (
  folder: BookmarkNode,
  visited: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 50
): BookmarkNode[] => {
  const bookmarks: BookmarkNode[] = []

  // 防止无限递归
  if (depth > maxDepth) {
    logger.warn('SidePanel', '⚠️ 递归深度超过限制，停止收集', { depth, folderId: folder.id })
    return bookmarks
  }

  // 防止循环引用
  if (visited.has(folder.id)) {
    logger.warn('SidePanel', '⚠️ 检测到循环引用，跳过文件夹', { folderId: folder.id })
    return bookmarks
  }

  visited.add(folder.id)

  if (!folder.children) {
    return bookmarks
  }

  for (const child of folder.children) {
    if (child.url) {
      // 是书签，添加到列表
      bookmarks.push(child)
    } else if (child.children) {
      // 是文件夹，递归收集
      bookmarks.push(...collectBookmarksFromFolder(child, visited, depth + 1, maxDepth))
    }
  }

  return bookmarks
}

/**
 * 处理分享完成
 * @description 分享完成后的回调
 * @returns {void} 无返回值
 */
const handleShareComplete = () => {
  logger.info('SidePanel', '✅ 分享完成')
  // 关闭分享弹窗
  showShareDialog.value = false
}

/**
 * 处理书签收藏/取消收藏
 * @description 切换书签的收藏状态
 * @param {BookmarkNode} node 书签节点
 * @param {boolean} isFavorite 是否收藏
 * @returns {void} 无返回值
 */
const handleBookmarkToggleFavorite = async (node: BookmarkNode, isFavorite: boolean) => {
  logger.info('SidePanel', `${isFavorite ? '⭐ 收藏' : '🗑️ 取消收藏'}书签:`, node.title)

  try {
    const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')

    // 执行收藏/取消收藏操作
    const success = isFavorite
      ? await favoriteAppService.addToFavorites(node.id) // 会自动进行去重检查
      : await favoriteAppService.removeFromFavorites(node.id)

    if (success) {
      // 操作成功，显示提示（根据实际操作显示正确的消息）
      message.info(isFavorite ? '书签已收藏' : '已取消收藏')

      // ✅ 直接更新节点的收藏状态，避免重新加载整个树
      // FavoriteBookmarks 组件会通过 favorite:added/removed 事件自动更新
      bookmarkStore.updateNode(node.id, { isFavorite })

      logger.debug('SidePanel', '✅ 书签收藏状态已更新')
    } else {
      // 操作失败（可能是用户取消了重复确认）
      logger.debug('SidePanel', '操作被取消或失败')
    }
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ 切换收藏状态失败:', error)
    message.error('操作失败，请重试')
  }
}

/**
 * 处理在新标签页打开书签
 * @description 处理在新标签页打开书签
 * @param {BookmarkNode} node 书签节点
 * @returns {void} 处理在新标签页打开书签
 * @throws {Error} 处理在新标签页打开书签失败
 */
/**
 * 检查 URL 是否为浏览器内部协议
 */
const isInternalProtocolUrl = (url: string): boolean => {
  if (!url) return false
  const lowerUrl = url.toLowerCase()
  return (
    lowerUrl.startsWith('chrome://') ||
    lowerUrl.startsWith('chrome-extension://') ||
    lowerUrl.startsWith('about:') ||
    lowerUrl.startsWith('file://') ||
    lowerUrl.startsWith('edge://') ||
    lowerUrl.startsWith('brave://')
  )
}

const handleBookmarkOpenNewTab = async (node: BookmarkNode) => {
  logger.info('SidePanel', '📂 在新标签页打开', node.title, node.url)

  if (!node.url) {
    message.warning('该书签没有有效的 URL')
    return
  }

  // 检查是否为内部协议书签（优先检查标签，兜底检查 URL）
  const hasInternalTag = node.traitTags?.includes('internal')
  const isInternalUrl = isInternalProtocolUrl(node.url)

  if (hasInternalTag || isInternalUrl) {
    message.warning('无法在新标签页打开浏览器内部链接')
    logger.warn('SidePanel', '尝试打开内部协议书签:', node.url)
    return
  }

  try {
    // 🔒 环境检查：确保在浏览器环境中运行
    if (typeof window === 'undefined') {
      logger.error('SidePanel', '非浏览器环境，无法打开链接')
      message.error('当前环境不支持打开链接')
      return
    }

    const newWindow = window.open(node.url, '_blank')

    // 检查是否被浏览器阻止
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      message.warning('链接被浏览器阻止，请检查弹窗设置')
      logger.warn('SidePanel', '链接被浏览器阻止:', node.url)
    } else {
      // 成功打开，更新访问记录
      await updateBookmarkVisitRecord(node.id)
    }
  } catch (error) {
    message.error('打开链接失败')
    logger.error('SidePanel', '打开链接失败:', error, node.url)
  }
}

/**
 * 处理复制书签URL
 * @description 处理复制书签URL
 * @param {BookmarkNode} node 书签节点
 * @returns {void} 处理复制书签URL
 * @throws {Error} 处理复制书签URL失败
 */
const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  logger.info('SidePanel', '📋 复制URL成功', node.title, node.url)

  // 统一通知封装
  try {
    message.success('书签链接已复制')
  } catch {
    logger.info('SidePanel', '✅ URL已复制到剪贴板', node.url)
  }
}

// 组件就绪回调：仅解除页面加载状态
const handleTreeReady = () => {
  isLoading.value = false
  logger.info('SidePanel', '📱 书签树组件就绪，数据加载完成')
}

/**
 * 实时同步状态与更新提示
 * @description 实时同步状态与更新提示
 * @returns {void} 实时同步状态与更新提示
 * @throws {Error} 实时同步状态与更新提示失败
 */
const lastSyncTime = ref<number>(0)
/**
 * 显示更新提示
 * @description 显示更新提示
 * @returns {boolean} 显示更新提示
 * @throws {Error} 显示更新提示失败
 */
const showUpdatePrompt = ref<boolean>(false)

const pendingUpdateDetail = ref<BookmarkUpdateDetail | null>(null)

/**
 * 设置实时同步监听器
 * 🆕 使用 mitt 事件总线替代 window.addEventListener
 * @description 设置实时同步监听器
 * @returns {void} 设置实时同步监听器
 * @throws {Error} 设置实时同步监听器失败
 */
const setupRealtimeSync = () => {
  // 监听书签更新事件（🆕 使用 mitt）
  const unsubscribeUpdate = onEvent('bookmark:updated', data => {
    logger.info('SidePanel', '🔄 收到书签更新事件', data)
    scheduleUIUpdate(
      () => {
        // 转换 mitt payload 为原有的 BookmarkUpdateDetail 格式
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

  // 监听数据库同步完成事件（🆕 使用 mitt），仅更新同步指示时间，避免打扰用户
  const unsubscribeSync = onEvent('data:synced', () => {
    scheduleUIUpdate(
      () => {
        lastSyncTime.value = Date.now()
        logger.info('SidePanel', '🟢 DB 同步完成，更新时间指示器')
      },
      { timeoutMs: 150 }
    )
  })

  // 监听书签访问事件，实时更新最近访问数量
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

  // 返回清理函数
  return () => {
    unsubscribeUpdate()
    unsubscribeSync()
    unsubscribeVisited()
  }
}

// 存储清理函数的引用
let cleanupSyncRef: (() => void) | null = null

/**
 * 初始化
 * @description 初始化
 * @returns {void} 初始化
 * @throws {Error} 初始化失败
 */
onMounted(async () => {
  try {
    logger.info('SidePanel', '🚀 SidePanel开始初始化...')

    // ✅ 1. 从 IndexedDB 加载书签数据（唯一数据源）
    isLoading.value = true
    try {
      await bookmarkStore.loadFromIndexedDB()
      logger.info('SidePanel', '✅ 书签数据加载完成')

      // ✅ 初始化统计数据（不依赖子组件挂载）
      try {
        // favoriteCount 现在是 computed，会自动更新

        // 从 IndexedDB 获取最近访问数量
        const recentVisits = await indexedDBManager.getRecentVisits(5)
        recentCount.value = recentVisits.length

        logger.info('SidePanel', '📊 统计数据初始化完成', {
          recent: recentCount.value,
          favorites: favoriteCount.value
        })
      } catch (error) {
        logger.warn('SidePanel', '⚠️ 统计数据初始化失败', error)
      }
    } catch (error) {
      logger.error('Component', 'SidePanel', '❌ 书签数据加载失败:', error)
    } finally {
      isLoading.value = false
    }

    // ✅ 2. 设置实时同步监听（保存到外部变量，在 onUnmounted 中清理）
    cleanupSyncRef = setupRealtimeSync()

    logger.info('SidePanel', '🎉 SidePanel初始化完成！')
  } catch (error) {
    logger.error('Component', 'SidePanel', '❌ SidePanel初始化失败:', error)
    isLoading.value = false
  }
})

/**
 * 清理
 * @description 清理
 * @returns {void} 清理
 * @throws {Error} 清理失败
 */
onUnmounted(() => {
  logger.info('SidePanel', '🧹 开始清理组件...')

  // 清理实时同步监听器
  if (cleanupSyncRef) {
    try {
      cleanupSyncRef()
      cleanupSyncRef = null
      logger.info('SidePanel', '✅ 实时同步监听器已清理')
    } catch (error) {
      logger.error('SidePanel', '❌ 清理监听器失败', error)
    }
  }

  // 安全重置loading状态
  isLoading.value = false

  logger.info('SidePanel', '✅ 组件清理完成')
})

/**
 * 刷新行动
 * @description 刷新行动
 * @returns {void} 刷新行动
 * @throws {Error} 刷新行动失败
 */
const confirmRefresh = async () => {
  try {
    scheduleMicrotask(() => (showUpdatePrompt.value = false))
    // 触发组件重载以刷新内部数据（在空闲时进行，避免阻塞交互）
    scheduleUIUpdate(
      () => {
        isLoading.value = true
        treeRefreshKey.value++
        lastSyncTime.value = Date.now()
        logger.info('SidePanel', '✅ 已刷新侧边栏数据')
      },
      { timeoutMs: 100 }
    )
  } catch (error) {
    logger.error('SidePanel', '❌ 刷新失败', error)
    // 刷新失败时也要重置loading状态
    isLoading.value = false
  }
}

/**
 * 暂缓刷新
 * @description 暂缓刷新
 * @returns {void} 暂缓刷新
 * @throws {Error} 暂缓刷新失败
 */
const postponeRefresh = () => {
  showUpdatePrompt.value = false
  logger.info('SidePanel', '⏸️ 已暂缓刷新侧边栏数据')
}
</script>

<template>
  <!-- 📊 全局书签同步进度对话框 -->
  <GlobalSyncProgress />

  <!-- ⚡ 全局快速添加书签对话框 -->
  <GlobalQuickAddBookmark />

  <!-- 📤 分享弹窗 -->
  <ShareDialog
    v-model:show="showShareDialog"
    :bookmarks="shareBookmarks"
    :share-type="shareType"
    v-bind="shareFolderName ? { folderName: shareFolderName } : {}"
    @share-complete="handleShareComplete"
  />

  <!-- 外部变更更新提示 -->
  <Dialog
    :show="showUpdatePrompt"
    :title="t('sidepanel_external_change_title')"
    icon="icon-sync-alert"
    @update:show="showUpdatePrompt = $event"
  >
    <div class="update-prompt-content">
      <p>{{ t('sidepanel_external_change_message') }}</p>
      <div v-if="pendingUpdateDetail" class="update-detail">
        <small>{{
          t('sidepanel_external_change_detail', [
            pendingUpdateDetail.eventType,
            pendingUpdateDetail.id
          ])
        }}</small>
      </div>
    </div>
    <template #actions>
      <md-text-button @click="postponeRefresh">{{ t('sidepanel_postpone') }}</md-text-button>
      <md-filled-button :disabled="isLoading" @click="confirmRefresh">
        {{ t('sidepanel_refresh_now') }}
      </md-filled-button>
    </template>
  </Dialog>

  <div class="side-panel-container">
    <!-- 顶部导航栏（侧边栏模式：隐藏 logo，避免与 Chrome 标题栏重复） -->
    <AppHeader
      :show-side-panel-toggle="false"
      :show-logo="false"
      :show-settings="false"
      :show-notification="true"
    />

    <!-- 搜索栏 -->
    <div class="search-section">
      <BookmarkSearchInput
        v-model:query="searchQuery"
        display-mode="full"
        mode="indexeddb"
        :limit="50"
        :enable-trait-filters="false"
        @result-click="openBookmark"
        @search-complete="handleSearchComplete"
        @search-clear="handleSearchClear"
      />
    </div>

    <!-- 百叶窗式折叠面板 -->
    <Accordion v-if="!searchQuery" :exclusive="true" default-expanded="tree">
      <!-- 最近访问 -->
      <AccordionItem id="recent" :title="t('sidepanel_recent_visits')" icon="icon-clock">
        <template #badge>
          <CountIndicator :count="recentCount" size="sm" variant="primary" />
        </template>
        <RecentVisits
          @bookmark-click="handleRecentClick"
          @bookmark-remove="handleRecentRemove"
          @count-update="recentCount = $event"
        />
      </AccordionItem>

      <!-- 收藏书签 -->
      <AccordionItem id="favorites" :title="t('sidepanel_favorites')" icon="icon-star">
        <template #badge>
          <CountIndicator :count="favoriteCount" size="sm" variant="primary" />
        </template>
        <FavoriteSection
          @bookmark-click="handleFavoriteClick"
          @bookmark-remove="handleFavoriteRemove"
          @share="handleShareFavorites"
        />
      </AccordionItem>

      <!-- 书签树 - 默认展开，可折叠 -->
      <AccordionItem id="tree" :title="t('sidepanel_bookmark_tree')" icon="icon-folder">
        <BookmarkTree
          :key="treeRefreshKey"
          :nodes="bookmarkTree"
          :selected-desc-counts="treeSelectedDescCounts"
          source="sidePanel"
          :loading="isLoading"
          height="auto"
          size="spacious"
          :searchable="false"
          :selectable="false"
          :editable="false"
          :show-toolbar="false"
          :accordion-mode="true"
          :show-favorite-button="true"
          :show-share-button="true"
          :show-open-new-tab-button="true"
          :show-copy-url-button="true"
          :show-bookmark-url="false"
          default-open-mode="current-tab"
          click-behavior="open"
          @ready="handleTreeReady"
          @node-click="handleBookmarkClick"
          @folder-toggle="handleFolderToggle"
          @bookmark-open-new-tab="handleBookmarkOpenNewTab"
          @bookmark-copy-url="handleBookmarkCopyUrl"
          @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
          @folder-share="handleFolderShare"
          @bookmark-share="handleBookmarkShare"
        />
      </AccordionItem>
    </Accordion>
  </div>
</template>

<style scoped>
.ai-badge-inline {
  margin-right: var(--spacing-1-5);
}

md-circular-progress {
  --md-circular-progress-size: 20px;
  --md-circular-progress-active-indicator-width: 3px;
}

.loading-state md-circular-progress {
  --md-circular-progress-size: 32px;
  --md-circular-progress-active-indicator-width: 4px;
}
</style>

<style scoped>
@keyframes sync-pulse {
  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

.side-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  color: var(--color-text-primary);
  background: var(--color-background);
  overflow: hidden;
}

/* 搜索区域固定高度 */
.search-section {
  flex-shrink: 0;
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-3) var(--spacing-4);
}

/* Accordion 容器占据剩余空间 */
.side-panel-container :deep(.accordion) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-right: var(--spacing-4);
  margin-left: var(--spacing-4);
  overflow: hidden;
}

/* AccordionItem 标题：固定高度 */
.side-panel-container :deep(.accordion-item) {
  flex-shrink: 0;
}

/* AccordionItem 内容区域：展开时占据所有剩余空间 */
.side-panel-container :deep(.accordion-content) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden auto;
}

/* BookmarkTree 容器：填充父容器，不设置滚动 */
.side-panel-container :deep(.bookmark-tree-wrapper) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 头部样式 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.settings-btn {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.settings-btn:hover {
  opacity: 1;
}

.close-btn {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.close-btn:hover {
  opacity: 1;
}

.sync-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: var(--spacing-sm);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-lg);
  background: var(--color-success-background);
}

.sync-icon {
  color: var(--color-success);

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: opacity;
  animation: sync-pulse 2s infinite;
}

/* 收藏夹区域 */
.favorites-section {
  padding: 0 var(--spacing-4) var(--spacing-3) var(--spacing-4);
}

.recommendations-section {
  padding: 0 var(--spacing-4) var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.recommendations-section :deep(.smart-recommendations) {
  padding: var(--spacing-sm) 0;
  border: none;
  background: transparent;
}

.recommendations-section :deep(.recommendations-title) {
  font-size: var(--text-base);
  color: var(--color-text-primary);
}

.recommendations-section :deep(.recommendation-item) {
  padding: var(--spacing-1-5) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.recommendations-section :deep(.recommendation-item:hover) {
  background: var(--color-background-hover);
}

.recommendations-section :deep(.bookmark-title) {
  font-size: var(--text-xs);
}

.recommendations-section :deep(.bookmark-meta) {
  font-size: var(--text-xs);
}

/* 书签树容器：不设置滚动，由 accordion-content 控制 */
.bookmark-tree {
  flex: 1;
  padding: var(--spacing-sm);
}

/* 搜索结果容器：不设置滚动，由 accordion-content 控制 */
.search-results {
  flex: 1;
  padding: var(--spacing-sm);
}

.search-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
}

.search-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-sm) var(--spacing-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none; /* 禁止文本选择 */
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.search-item:hover {
  border-color: var(--color-border-hover);
  background: var(--color-surface-hover);
}

.search-item:active {
  background: var(--color-surface-active);

  /* 避免缩放引起视觉位移与重排 */
  box-shadow: 0 0 0 2px var(--color-primary-alpha-10) inset;
}

.search-item-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  width: 20px;
  height: 20px;
  user-select: none; /* 禁止图标选择 */
}

.search-item-icon img {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  user-select: none; /* 禁止图片选择 */
  pointer-events: none; /* 防止图片拖拽 */
}

.search-item-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0; /* 移除默认间距，由各元素的margin控制 */
  min-width: 0;
}

.search-item-title {
  margin-bottom: var(--spacing-0-5); /* 与URL的间距 */
  font-size: var(--text-base);
  font-weight: 600; /* 加粗书签名称 */
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-highlight {
  padding: 0 1px;
  border-radius: var(--radius-xs);
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-warning-alpha-20);
}

.search-item-path {
  margin-top: var(--spacing-0-5); /* 与其他元素保持一致的间距 */
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border-left: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs); /* 增大字体提升可读性 */
  font-style: italic;
  white-space: nowrap;
  color: var(--color-text-secondary); /* 使用次级文本颜色，比三级更明显 */
  background: var(--color-surface-variant);
  opacity: 0.95; /* 稍微增加不透明度 */
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-item-url {
  margin: -1px calc(-1 * var(--spacing-1)) var(--spacing-0-5) calc(-1 * var(--spacing-1)); /* 添加底部间距与路径保持一致 */
  padding: 1px var(--spacing-1);
  border-radius: var(--radius-xs);
  outline: none; /* 移除focus时的边框 */
  font-size: var(--text-sm); /* 增大字体提升可读性 */
  text-decoration: none;
  white-space: nowrap; /* URL单行显示 */
  color: var(--color-primary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  overflow: hidden; /* 隐藏超出部分 */
  text-overflow: ellipsis; /* 超出显示省略号 */
}

.search-item-url:hover {
  text-decoration: underline;
  color: var(--color-primary-400, var(--color-primary));
  background: var(--color-primary-alpha-10);
}

.search-item-url:focus {
  outline: none; /* 移除focus时的边框 */
  box-shadow: none; /* 移除可能的阴影 */
}

.search-item-url:visited {
  color: var(--color-primary); /* 访问后保持相同颜色 */
}

.search-item-url:active {
  color: var(--color-primary); /* 点击时保持相同颜色 */
  background: none; /* 移除点击时的背景 */
}

/* 加载和空状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-10) var(--spacing-5);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-16) var(--spacing-5);
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 滚动条使用浏览器默认样式 */
</style>
