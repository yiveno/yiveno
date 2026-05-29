/**
 * 跨页面同步 Composable
 *
 * 职责：
 * - 统一管理跨页面消息同步
 * - 监听 chrome.storage.session 变更
 * - 自动更新 Pinia Store
 *
 * 设计原则：
 * - Pinia Store 是唯一的 UI 数据源
 * - 收到跨页面消息后直接更新 Store，Vue 响应式自动更新 UI
 * - 不使用 Event Bus，避免多个消息系统混用
 */

import { onMounted, onUnmounted } from 'vue'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 跨页面消息类型
 */
interface CrossPageMessage {
  type: string
  action?: string
  bookmarkId?: string
  timestamp?: number
}

/**
 * 初始化跨页面同步
 *
 * 在页面入口（main.ts 或根组件）调用一次即可
 *
 * @example
 * ```typescript
 * // main.ts
 * import { initCrossPageSync } from '@/composables/useCrossPageSync'
 * initCrossPageSync()
 * ```
 */
export function initCrossPageSync(): () => void {
  const bookmarkStore = useBookmarkStore()

  const handleStorageChange = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    // 只处理 session storage 中的事件
    if (areaName !== 'session') return

    // 处理收藏变更事件
    if (changes.__favoriteEvent) {
      const event = changes.__favoriteEvent.newValue as CrossPageMessage | null
      if (!event || event.type !== 'FAVORITE_CHANGED') return

      const { action, bookmarkId } = event
      if (!bookmarkId) return

      logger.debug('CrossPageSync', `📨 收到跨页面收藏事件: ${action} - ${bookmarkId}`)

      // ✅ 直接更新 Pinia Store，Vue 响应式自动更新 UI
      if (action === 'added') {
        bookmarkStore.updateNode(bookmarkId, { isFavorite: true })
      } else if (action === 'removed') {
        bookmarkStore.updateNode(bookmarkId, { isFavorite: false })
      }
    }

    // 可扩展：处理其他跨页面事件
    // if (changes.__otherEvent) { ... }
  }

  // 注册监听器
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange)
    logger.debug('CrossPageSync', '✅ 跨页面同步已初始化')
  }

  // 返回清理函数
  return () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(handleStorageChange)
      logger.debug('CrossPageSync', '🔌 跨页面同步已卸载')
    }
  }
}

/**
 * Vue Composable 版本
 *
 * 在组件中使用，自动管理生命周期
 *
 * @example
 * ```vue
 * <script setup>
 * import { useCrossPageSync } from '@/composables/useCrossPageSync'
 * useCrossPageSync()
 * </script>
 * ```
 */
export function useCrossPageSync() {
  let cleanup: (() => void) | null = null

  onMounted(() => {
    cleanup = initCrossPageSync()
  })

  onUnmounted(() => {
    cleanup?.()
  })
}
