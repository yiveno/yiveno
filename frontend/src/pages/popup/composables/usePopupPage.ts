import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useThemeSync } from '@/composables/useThemeSync'
import { useTraitLoading } from '@/composables/useTraitData'
import { tabBrowserAppService } from '@/application/browser/tab-browser-app-service'
import { logger } from '@/infrastructure/logging/logger'
import type { useUIStore } from '@/stores/ui-store'
import type { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
import { t } from '@/utils/i18n-helpers'
import type { PopupIssueType, PopupFilterKey } from '../types'

type UIStore = ReturnType<typeof useUIStore>
type PopupStore = ReturnType<typeof usePopupStoreIndexedDB>

const FILTER_TAG_MAP: Record<PopupFilterKey, string[]> = {
  duplicate: ['duplicate'],
  invalid: ['invalid'],
  dead: ['invalid'],
  internal: ['internal']
}

function getExtensionPageUrl(page: 'management' | 'settings'): string {
  return chrome?.runtime?.getURL ? chrome.runtime.getURL(`${page}.html`) : `/${page}.html`
}

/** 在新标签页打开扩展内部页面（经 Background 路由） */
async function openExtensionPage(page: 'management' | 'settings'): Promise<void> {
  const result =
    page === 'management'
      ? await tabBrowserAppService.openManagementPage()
      : await tabBrowserAppService.openSettingsPage()

  if (!result.ok) {
    const url = getExtensionPageUrl(page)
    logger.warn('Popup', `Background 打开 ${page} 失败，使用 window.open`, result.error)
    window.open(url, '_blank')
  }
}

/**
 * 将 Popup 页逻辑集中在单一 composable 中，减少组件体积并提升可维护性。
 */
export function usePopupPage() {
  useThemeSync('Popup')

  const uiStore = shallowRef<UIStore | null>(null)
  const popupStore = shallowRef<PopupStore | null>(null)

  const cleanupCallbacks: Array<() => void> = []
  const isLoadingTraitOverview = useTraitLoading()

  function registerCleanup(callback: () => void): void {
    cleanupCallbacks.push(callback)
  }

  function runCleanupCallbacks(): void {
    for (const cb of cleanupCallbacks.splice(0)) {
      try {
        cb()
      } catch (error) {
        logger.warn('Popup', '执行清理回调失败', error)
      }
    }
  }

  function handleTogglePopupCommand(command: string): void {
    if (command !== 'open-popup' && command !== '_execute_action') return
    try {
      window.close()
    } catch (error) {
      logger.warn('Popup', '尝试关闭弹出页失败', error)
    }
  }

  function openManualOrganizePage(): void {
    void openExtensionPage('management')
  }

  function openSettings(): void {
    void openExtensionPage('settings')
  }

  async function openSidePanel(): Promise<void> {
    const result = await tabBrowserAppService.openSidePanel()
    if (!result.ok) {
      logger.warn('Popup', '侧边栏打开失败', result.error)
      uiStore.value?.showWarning(t('popup_sidepanel_unavailable'))
    }
  }

  async function openManagementWithFilter(key: PopupFilterKey): Promise<void> {
    try {
      const tags = FILTER_TAG_MAP[key] ?? []
      if (tags.length === 0) {
        openManualOrganizePage()
        return
      }
      await chrome.storage.session.set({
        managementInitialFilter: { tags, timestamp: Date.now() }
      })
      void openExtensionPage('management')
    } catch (error) {
      logger.error('Popup', 'openManagementWithFilter 错误:', error)
      openManualOrganizePage()
    }
  }

  function handleIssueRowClick(kind: PopupIssueType, event: Event): void {
    if (event.target instanceof Element && event.target.closest('.issue-action')) return
    void openManagementWithFilter(kind === 'duplicate' ? 'duplicate' : 'dead')
  }

  function handleUrlTriggeredAddBookmark(): void {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') !== 'add-bookmark') return

    setTimeout(() => {
      try {
        void chrome.runtime.sendMessage({
          type: 'SHOW_ADD_BOOKMARK_DIALOG',
          data: {
            title: params.get('title') || '',
            url: params.get('url') || '',
            favIconUrl: params.get('favIconUrl') || ''
          }
        })
      } catch (error) {
        logger.warn('Popup', '触发添加书签对话框失败', error)
      }
    }, 100)
  }

  function registerCommandListener(): void {
    if (!chrome?.commands?.onCommand) return
    chrome.commands.onCommand.addListener(handleTogglePopupCommand)
    registerCleanup(() => {
      try {
        chrome.commands.onCommand.removeListener(handleTogglePopupCommand)
      } catch (error) {
        logger.warn('Popup', '移除命令快捷键监听失败', error)
      }
    })
  }

  async function bootstrapPopup(): Promise<void> {
    try {
      const [authModule, uiStoreModule, popupStoreModule] = await Promise.all([
        import('@/composables/useSupabaseAuth'),
        import('@/stores/ui-store'),
        import('@/stores/popup-store-indexeddb')
      ])

      const { initialize: initAuth, setupAuthListener } = authModule.useSupabaseAuth()
      await initAuth()
      setupAuthListener()

      uiStore.value = uiStoreModule.useUIStore()
      popupStore.value = popupStoreModule.usePopupStoreIndexedDB()
      uiStore.value.setCurrentPage('popup', 'otterSagePopup')

      try {
        await popupStore.value.initialize()
      } catch (initError) {
        logger.warn('Popup', 'PopupStore初始化失败，使用默认状态', initError)
        uiStore.value.showWarning('部分功能初始化失败，但基本功能仍可使用')
      }
    } catch (error) {
      logger.error('Component', 'Popup', 'Popup整体初始化失败', error)
      uiStore.value?.showError(`初始化失败: ${(error as Error).message}`)
    }
  }

  onMounted(() => {
    logger.info('Popup', 'Popup 启动')
    handleUrlTriggeredAddBookmark()
    registerCommandListener()
    void bootstrapPopup()
  })

  onUnmounted(() => runCleanupCallbacks())

  return {
    isLoadingTraitOverview,
    isStoresReady: computed(() => Boolean(uiStore.value && popupStore.value)),
    handleIssueRowClick,
    openManagementWithFilter,
    openManualOrganizePage,
    openSettings,
    openSidePanel
  }
}
