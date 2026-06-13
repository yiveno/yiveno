/* eslint-disable require-atomic-updates */
import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { message } from '@/application/message/message-service'
import { notificationService } from '@/application/notification/notification-service'
import { NOTIFICATION_CONFIG } from '@/config/constants'
import { onEvent } from '@/infrastructure/events/event-bus'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkNode } from '@/types'
import type { TraitTag } from '@/types/domain/trait'
import type BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
import { t } from '@/utils/i18n-helpers'

type BookmarkTreeInstance = InstanceType<typeof BookmarkTree>

interface BookmarkIndexLike {
  buildFromTree(nodes: BookmarkNode[]): void
  getSize(): number
}

interface UseManagementLifecycleOptions {
  bookmarkManagementStore: {
    initialize: () => Promise<void>
    isApplyingOwnChanges: boolean
    hasUnsavedChanges: boolean
    newProposalTree: { children?: BookmarkNode[] }
  }
  traitFilterStore: {
    setActiveFilters: (filters: TraitTag[]) => void
    filterResultIds: string[]
  }
  rightTreeIndex: BookmarkIndexLike
  rightTreeData: Ref<BookmarkNode[]>
  originalTree: Ref<BookmarkNode[]>
  isPageLoading: Ref<boolean>
  loadingMessage: Ref<string>
  leftTreeRef: Ref<BookmarkTreeInstance | null>
  rightTreeRef: Ref<BookmarkTreeInstance | null>
  clearRightSelection: () => void
}

function readPendingFilterFromSession(): Promise<TraitTag[]> {
  return chrome.storage.session.get('managementInitialFilter').then(result => {
    if (!result.managementInitialFilter) {
      return []
    }

    const filter = result.managementInitialFilter as {
      tags?: string[]
      timestamp?: number
    }

    const { tags, timestamp } = filter
    if (tags && timestamp && Date.now() - timestamp < 5000) {
      return tags.filter((tag: string): tag is TraitTag =>
        ['duplicate', 'invalid', 'internal'].includes(tag)
      )
    }
    return []
  })
}

function readPendingFilterFromUrl(): TraitTag[] {
  try {
    if (typeof window === 'undefined') {
      return []
    }

    const params = new URLSearchParams(window.location.search)
    const tagsParam = params.get('tags')
    if (!tagsParam) return []

    return tagsParam
      .split(',')
      .map(tag => tag.trim())
      .filter((tag): tag is TraitTag => ['duplicate', 'invalid', 'internal'].includes(tag))
  } catch (error) {
    logger.warn('Management', '解析 URL 参数失败:', error)
    return []
  }
}

export function useManagementLifecycle(options: UseManagementLifecycleOptions): {
  pendingTagSelection: Ref<TraitTag[] | null>
} {
  const pendingTagSelection = ref<TraitTag[] | null>(null)

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (options.bookmarkManagementStore.hasUnsavedChanges) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  async function handleExternalChange(data: {
    eventType: 'created' | 'changed' | 'moved' | 'removed'
    bookmarkId?: string
    timestamp: number
  }): Promise<void> {
    if (options.bookmarkManagementStore.isApplyingOwnChanges) {
      logger.debug('Management', '检测到自己触发的变更，忽略', data)
      return
    }

    logger.info('Management', '🔄 检测到外部书签变更', data)

    if (options.bookmarkManagementStore.hasUnsavedChanges) {
      logger.warn('Management', '用户有未保存的修改，暂不自动刷新')
      return
    }

    try {
      await options.bookmarkManagementStore.initialize()
      logger.info('Management', '✅ 已静默刷新书签数据')
      message.info(t('management_external_change_detected'))
    } catch (error) {
      logger.error('Management', '静默刷新失败', error)
      message.error(t('management_refresh_failed'))
    }
  }

  const unsubscribeExternalChange = onEvent('data:synced', handleExternalChange)

  async function initializeManagementPage(): Promise<void> {
    await options.bookmarkManagementStore.initialize()

    let pendingTags: TraitTag[] = []
    try {
      pendingTags = await readPendingFilterFromSession()
      if (pendingTags.length > 0) {
        logger.info('Management', '从 session storage 读取筛选参数:', pendingTags)
        await chrome.storage.session.remove('managementInitialFilter')
      }
    } catch (error) {
      logger.warn('Management', '读取 session storage 失败:', error)
    }

    if (pendingTags.length === 0) {
      pendingTags = readPendingFilterFromUrl()
      if (pendingTags.length > 0) {
        logger.info('Management', '从 URL 参数读取筛选:', pendingTags)
      }
    }

    if (pendingTags.length > 0) {
      logger.info('Management', '准备激活筛选:', pendingTags)
      await nextTick()
      options.traitFilterStore.setActiveFilters(pendingTags)
      pendingTagSelection.value = pendingTags
      await nextTick()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)

      const g = window as unknown as Record<string, unknown>
      g.OS_setFolderExpanded = (id: string, expanded?: boolean) => {
        const comp = options.leftTreeRef.value
        if (!comp) return
        const sid = String(id)
        if (expanded === undefined) {
          comp.toggleFolderById?.(sid)
          return
        }
        if (expanded) {
          comp.expandFolderById?.(sid)
        } else {
          comp.collapseFolderById?.(sid)
        }
      }
      g.OS_toggleFolder = (id: string) => {
        const comp = options.leftTreeRef.value
        if (!comp) return
        comp.toggleFolderById?.(String(id))
      }
      g.OS_focusBookmark = (
        id: string,
        opts?: {
          collapseOthers?: boolean
          scrollIntoViewCenter?: boolean
          pathIds?: string[]
        }
      ) => {
        const comp = options.leftTreeRef.value
        if (!comp?.focusNodeById) return
        comp.focusNodeById(
          String(id),
          opts || {
            collapseOthers: true,
            scrollIntoViewCenter: true
          }
        )
      }
    }
  }

  watch(
    () => options.rightTreeData.value,
    newData => {
      if (Array.isArray(newData) && newData.length > 0) {
        options.rightTreeIndex.buildFromTree(newData)
        logger.info('Management', `右侧树索引已更新: ${options.rightTreeIndex.getSize()} 个节点`)
      }
    },
    { immediate: true, deep: false }
  )

  watch(
    () => options.rightTreeData.value,
    () => {
      options.clearRightSelection()
    },
    { deep: true }
  )

  watch(
    () => options.bookmarkManagementStore.hasUnsavedChanges,
    hasChanges => {
      if (hasChanges) {
        notificationService.updateBadge('!', NOTIFICATION_CONFIG.BADGE_COLORS.warning)
      } else {
        notificationService.clearBadge()
      }
    },
    { immediate: true }
  )

  watch(
    () => options.bookmarkManagementStore.newProposalTree,
    async newTree => {
      if (!newTree || !pendingTagSelection.value?.length) return

      await nextTick()
      pendingTagSelection.value = null

      const ids = options.traitFilterStore.filterResultIds
      if (!ids.length || !options.rightTreeRef.value) return

      const instance = options.rightTreeRef.value
      try {
        if (typeof instance.selectNodesByIds === 'function') {
          instance.selectNodesByIds(ids, { append: false })
        }
        const firstId = ids[0]
        if (firstId && typeof instance.focusNodeById === 'function') {
          await instance.focusNodeById(firstId, {
            scrollIntoViewCenter: true
          })
        }
      } catch (error) {
        logger.warn('Management', 'Focus', '自动选中健康问题节点失败', error)
      }
    },
    { deep: false }
  )

  onMounted(async () => {
    try {
      await initializeManagementPage()
    } catch (error) {
      logger.error('Management', '❌ Management初始化失败', error)
    }
  })

  onUnmounted(() => {
    unsubscribeExternalChange()
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  })

  return { pendingTagSelection }
}
