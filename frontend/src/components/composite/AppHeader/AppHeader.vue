<script setup lang="ts">
import ThemeToggle from '@/components/composite/ThemeToggle/ThemeToggle.vue'
import UserMenu from '@/components/composite/UserMenu/UserMenu.vue'
import LucideIcon from '@/components/base/LucideIcon/LucideIcon.vue'
import { ref, computed, toRefs, onMounted, onUnmounted } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { globalStateManager } from '@/infrastructure/global-state/global-state-manager'

const props = withDefaults(
  defineProps<{
    showSidePanelToggle?: boolean
    showLogo?: boolean
    showName?: boolean
    showTheme?: boolean
    showSettings?: boolean
    showAccount?: boolean
  }>(),
  {
    showSidePanelToggle: true,
    showLogo: true,
    showName: true,
    showTheme: true,
    showSettings: true,
    showAccount: true
  }
)

const { showSidePanelToggle, showLogo, showName, showTheme, showSettings, showAccount } =
  toRefs(props)

// 当前主题
const currentTheme = ref<'light' | 'dark' | 'system'>('system')

// 根据主题动态切换 logo
const logoSrc = computed(() => {
  // 如果是 system 模式，根据实际系统主题决定
  if (currentTheme.value === 'system') {
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return systemIsDark ? '/logo-dark.webp' : '/logo.webp'
  }
  return currentTheme.value === 'dark' ? '/logo-dark.webp' : '/logo.webp'
})

/**
 * 头部样式类，根据是否展示左侧面板按钮动态调整列布局。
 */
const headerClasses = computed(() => [
  'app-header',
  {
    'app-header--no-left': !showSidePanelToggle.value
  }
])

// 固定提示文案
const sidePanelTooltip = '打开侧边栏'

/**
 * 打开侧边栏
 * 注意：只负责打开，不处理关闭逻辑（side-panel 有自己的关闭按钮）
 */
const handleOpenSidePanel = async () => {
  try {
    if (!chrome?.sidePanel) {
      logger.warn('AppHeader', '浏览器不支持侧边栏功能')
      return
    }

    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (!currentTab?.id || !currentTab?.windowId) {
      logger.error('AppHeader', '无法获取当前标签页信息')
      return
    }

    // 打开侧边栏
    await chrome.sidePanel.setOptions({
      tabId: currentTab.id,
      path: 'side-panel.html',
      enabled: true
    })

    if (chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: false
      })
    }

    await chrome.sidePanel.open({ windowId: currentTab.windowId })
    logger.info('AppHeader', '✅ 侧边栏已打开')
  } catch (error) {
    logger.error('AppHeader', '❌ 打开侧边栏失败', error)
  }
}

/**
 * 打开设置页面
 * 智能行为：
 * - 如果 settings 页面已打开，则切换到该标签页
 * - 如果未打开，则打开新标签页
 *
 * 通过 background script 处理，确保有足够的权限访问所有标签页
 */
const handleOpenSettings = async () => {
  try {
    // 通过消息机制调用 background script 的智能打开功能
    if (chrome?.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'OPEN_SETTINGS_PAGE'
      })
    } else {
      // 降级方案：直接打开新标签页
      const settingsUrl = chrome?.runtime?.getURL
        ? chrome.runtime.getURL('settings.html')
        : '/settings.html'
      window.open(settingsUrl, '_blank')
    }
  } catch (error) {
    // 降级方案：直接打开新标签页
    logger.warn('AppHeader', 'Settings', 'Failed to open settings via background', error)
    const fallbackUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('settings.html')
      : '/settings.html'
    window.open(fallbackUrl, '_blank')
  }
}

// 初始化主题
const initTheme = async () => {
  try {
    await globalStateManager.initialize()
    currentTheme.value = globalStateManager.getTheme()
  } catch (error) {
    logger.error('AppHeader', '初始化主题失败', error)
  }
}

// 组件挂载时检查主题
onMounted(() => {
  initTheme()

  // 监听主题切换事件
  const unsubscribeTheme = onEvent('theme:changed', (data) => {
    const payload = data as { theme: 'light' | 'dark' }
    if (currentTheme.value !== 'system') {
      currentTheme.value = payload.theme
    }
  })

  // 监听页面可见性变化（当从其他页面返回时刷新主题）
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      initTheme()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 清理函数
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    unsubscribeTheme()
  })
})
</script>

<template>
  <header :class="headerClasses" aria-label="AcuityBookmarks">
    <div
      v-if="showSidePanelToggle"
      class="app-header__col app-header__col--left"
    >
      <md-icon-button
        class="app-header__action"
        :style="{ '--md-icon-button-icon-size': '30px' }"
        :title="sidePanelTooltip"
        :aria-label="sidePanelTooltip"
        @click="handleOpenSidePanel"
      >
        <LucideIcon name="panel-left" :size="30" />
      </md-icon-button>
    </div>

    <div class="app-header__col app-header__col--center">
      <img
        v-if="showLogo"
        :src="logoSrc"
        alt="AcuityBookmarks Logo"
        class="app-header__logo"
      />
      <span v-if="showName" class="app-header__name">AcuityBookmarks</span>
    </div>

    <div class="app-header__col app-header__col--right">
      <ThemeToggle v-if="showTheme" />
      <UserMenu v-if="showAccount" :size="30" />
      <md-icon-button
        v-if="showSettings"
        class="app-header__action"
        :style="{ '--md-icon-button-icon-size': '30px' }"
        title="打开设置"
        aria-label="打开设置"
        @click="handleOpenSettings"
      >
        <LucideIcon name="settings" :size="30" />
      </md-icon-button>
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  align-items: center;
  grid-template-columns: repeat(3, 1fr);
  height: 56px;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);

  /* 顶部背景：基于项目语义 surface 与 primary 的轻量叠加 */
  background: color-mix(
    in srgb,
    var(--color-surface-container-lowest) 88%,
    var(--color-primary) 12%
  );
  backdrop-filter: blur(10px);
}

.app-header--no-left {
  grid-template-columns: 1fr 1fr;
}

.app-header--no-left .app-header__col--center {
  justify-content: flex-start;
}

.app-header__col {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
}

.app-header__col--left {
  justify-content: flex-start;
}

.app-header__col--right {
  justify-content: flex-end;
  gap: var(--spacing-xs);
}

.app-header__logo {
  width: 28px;
  height: 28px;
}

.app-header__name {
  margin-left: var(--spacing-xs);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  white-space: nowrap;
  color: var(--color-text-primary);
}

.app-header__action {
  color: var(--color-text-secondary);
}
</style>
