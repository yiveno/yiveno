<script setup lang="ts">
import ThemeToggle from '@/components/composite/ThemeToggle/ThemeToggle.vue'
import UserMenu from '@/components/composite/UserMenu/UserMenu.vue'
import LucideIcon from '@/components/base/LucideIcon/LucideIcon.vue'
import NotificationList from '@/components/business/NotificationList/NotificationList.vue'
import { ref, computed, toRefs, onMounted, onUnmounted } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import { globalStateManager } from '@/infrastructure/global-state/global-state-manager'
import { inboxNotification } from '@/application/inbox-notification/inbox-notification-service'
import { tabBrowserAppService } from '@/application/browser/tab-browser-app-service'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
import { Button } from '@/components'

const props = withDefaults(
  defineProps<{
    showSidePanelToggle?: boolean
    showLogo?: boolean
    showName?: boolean
    showTheme?: boolean
    showSettings?: boolean
    showNotification?: boolean
    showAccount?: boolean
  }>(),
  {
    showSidePanelToggle: true,
    showLogo: true,
    showName: false,
    showTheme: true,
    showSettings: true,
    showNotification: false,
    showAccount: true
  }
)

const {
  showSidePanelToggle,
  showLogo,
  showName,
  showTheme,
  showSettings,
  showNotification,
  showAccount
} = toRefs(props)

// ==================== 认证状态（useSupabaseAuth 首次调用时会自动 initialize） ====================
const { isAuthenticated } = useSupabaseAuth()

// 通知按钮只在登录状态下显示
const shouldShowNotification = computed(() => showNotification.value && isAuthenticated.value)

// ==================== 主题相关 ====================
const currentTheme = ref<'light' | 'dark' | 'system'>('system')

// 根据主题动态切换 logo
const logoSrc = computed(() => {
  if (currentTheme.value === 'system') {
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return systemIsDark ? '/logo-dark.webp' : '/logo.webp'
  }
  return currentTheme.value === 'dark' ? '/logo-dark.webp' : '/logo.webp'
})

// ==================== 通知相关 ====================
const showNotificationList = ref(false)
const unreadCount = computed(() => inboxNotification.unreadCount.value)
const notificationWrapperRef = ref<HTMLElement | null>(null)
const isBellRinging = ref(false)

function toggleNotificationList(): void {
  showNotificationList.value = !showNotificationList.value
  logger.info('AppHeader', '切换通知列表', {
    show: showNotificationList.value
  })

  if (showNotificationList.value) {
    isBellRinging.value = true
    setTimeout(() => {
      isBellRinging.value = false
    }, 500)
  }
}

function closeNotificationList(): void {
  showNotificationList.value = false
}

function handleClickOutside(event: MouseEvent): void {
  if (
    showNotificationList.value &&
    notificationWrapperRef.value &&
    !notificationWrapperRef.value.contains(event.target as Node)
  ) {
    closeNotificationList()
  }
}

// ==================== 样式类 ====================
const headerClasses = computed(() => [
  'app-header',
  {
    'app-header--no-left': !showSidePanelToggle.value
  }
])

// ==================== 侧边栏 ====================
const sidePanelTooltip = '打开侧边栏'

const handleOpenSidePanel = async () => {
  try {
    const result = await tabBrowserAppService.openSidePanel()
    if (result.ok) {
      logger.info('AppHeader', '✅ 侧边栏已打开')
      return
    }
    logger.error('AppHeader', '❌ 打开侧边栏失败', result.error)
  } catch (error) {
    logger.error('AppHeader', '❌ 打开侧边栏失败', error)
  }
}

// ==================== 设置 ====================
const handleOpenSettings = async () => {
  try {
    if (chrome?.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'OPEN_SETTINGS_PAGE'
      })
    } else {
      const settingsUrl = chrome?.runtime?.getURL
        ? chrome.runtime.getURL('settings.html')
        : '/settings.html'
      window.open(settingsUrl, '_blank')
    }
  } catch (error) {
    logger.warn('AppHeader', 'Settings', 'Failed to open settings via background', error)
    const fallbackUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('settings.html')
      : '/settings.html'
    window.open(fallbackUrl, '_blank')
  }
}

// ==================== 初始化 ====================
const initTheme = async () => {
  try {
    await globalStateManager.initialize()
    currentTheme.value = globalStateManager.getTheme()
  } catch (error) {
    logger.error('AppHeader', '初始化主题失败', error)
  }
}

onMounted(async () => {
  // 初始化主题
  void initTheme()

  // 初始化通知服务（只在登录状态下）
  if (shouldShowNotification.value) {
    try {
      await inboxNotification.initialize()
      logger.info('AppHeader', '通知服务已初始化')
    } catch (error) {
      logger.warn('AppHeader', '通知服务初始化失败', error)
    }

    // 监听点击外部关闭通知列表
    document.addEventListener('click', handleClickOutside)
  }

  // 监听主题切换事件
  const unsubscribeTheme = onEvent('theme:changed', data => {
    const payload = data as { theme: 'light' | 'dark' }
    if (currentTheme.value !== 'system') {
      currentTheme.value = payload.theme
    }
  })

  // 监听页面可见性变化
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      void initTheme()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 清理函数
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    document.removeEventListener('click', handleClickOutside)
    unsubscribeTheme()
  })
})
</script>

<template>
  <header :class="headerClasses" aria-label="Yiveno">
    <div v-if="showSidePanelToggle" class="app-header__col app-header__col--left">
      <Button
        variant="icon"
        class="app-header__action"
        :icon-size="30"
        :title="sidePanelTooltip"
        :aria-label="sidePanelTooltip"
        @click="handleOpenSidePanel"
      >
        <LucideIcon name="panel-left" :size="30" />
      </Button>
    </div>

    <div class="app-header__col app-header__col--center">
      <img v-if="showLogo" :src="logoSrc" alt="Yiveno Logo" class="app-header__logo" />
      <span v-if="showName" class="app-header__name">Yiveno</span>
    </div>

    <div class="app-header__col app-header__col--right">
      <ThemeToggle v-if="showTheme" />
      <Button
        v-if="showSettings"
        variant="icon"
        class="app-header__action"
        :icon-size="30"
        title="打开设置"
        aria-label="打开设置"
        @click="handleOpenSettings"
      >
        <LucideIcon name="settings" :size="30" />
      </Button>

      <!-- 通知按钮（只在登录状态下显示） -->
      <div v-if="shouldShowNotification" ref="notificationWrapperRef" class="notification-wrapper">
        <Button
          variant="icon"
          class="app-header__action notification-button md-emphasis-flash"
          :class="{ 'md-emphasis-flash--active': isBellRinging }"
          :icon-size="30"
          title="通知"
          aria-label="通知"
          @click="toggleNotificationList"
        >
          <LucideIcon name="bell" :size="30" />
          <!-- 未读数量徽章 -->
          <span v-if="unreadCount > 0" class="notification-badge">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </Button>

        <!-- 通知列表浮窗 -->
        <div v-if="showNotificationList" class="notification-popover">
          <NotificationList @close="closeNotificationList" />
        </div>
      </div>

      <slot name="actions" />
      <UserMenu v-if="showAccount" :size="30" />
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
  transition: color var(--md-sys-motion-duration-short2);
}

.app-header__action:hover {
  color: var(--color-primary);
}

/* ==================== 通知相关样式 ==================== */

/* 通知包装器 */
.notification-wrapper {
  position: relative;
}

/* 通知按钮 */
.notification-button {
  position: relative;
}

/* 未读数量徽章 */
.notification-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  line-height: 1;
  color: var(--color-on-error);
  background: var(--color-error);
  pointer-events: none;
}

/* 通知列表浮窗 */
.notification-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: -13px;
  z-index: 1000;
  width: 360px;
  max-height: 480px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-container);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
</style>
