<template>
  <!-- 📊 全局书签同步进度对话框 -->
  <GlobalSyncProgress />

  <!-- ⚡ 全局快速添加书签对话框 -->
  <GlobalQuickAddBookmark />

  <App app class="app-container">
    <AppHeader
      :show-side-panel-toggle="false"
      :show-settings="false"
      :show-account="false"
    />
    <Main class="main-content">
      <div class="settings-body">
        <aside
          class="settings-sidebar"
          aria-label="Settings Sections"
          data-testid="settings-sidebar"
        >
          <Tabs
            v-model="tab"
            :tabs="tabsI18n"
            variant="pills"
            orientation="vertical"
            :aria-label="t('settings_sidebar')"
            data-testid="tabs-vertical"
          />
        </aside>

        <main class="settings-content" role="region">
          <div v-if="tab === 'general'" class="pane">
            <component :is="GeneralSettings" />
          </div>
          <div v-else-if="tab === 'ai'" class="pane">
            <component :is="AISettings" />
          </div>
          <div v-else-if="tab === 'notifications'" class="pane">
            <component :is="NotificationSettings" />
          </div>
          <div v-else-if="tab === 'subscription'" class="pane">
            <div class="subscription-redirect">
              <div class="subscription-redirect__icon">
                <LucideIcon name="crown" :size="48" />
              </div>
              <h2 class="subscription-redirect__title">订阅管理已迁移到官网</h2>
              <p class="subscription-redirect__description">
                为了提供更好的订阅管理体验，我们已将订阅功能迁移到官网。
              </p>
              <md-filled-button
                class="subscription-button"
                @click="handleOpenSubscriptionPage"
              >
                <md-icon>open_in_new</md-icon>
                前往官网管理订阅
              </md-filled-button>
            </div>
          </div>
          <div v-else-if="tab === 'shortcuts'" class="pane">
            <component :is="ShortcutSettings" />
          </div>
        </main>
      </div>
    </Main>
  </App>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'
import { App, AppHeader, Main, Tabs, LucideIcon } from '@/components'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
import { t } from '@/infrastructure'
import { onEvent } from '@/infrastructure/events/event-bus'
import { useSupabaseAuth } from '@/composables'
import { logger } from '@/infrastructure/logging/logger'
import { websiteUrls, openWebsiteUrl } from '@/config/website'

// 使用 Supabase Auth 检查登录状态
const { isAuthenticated, initialize } = useSupabaseAuth()
const isLoggedIn = computed(() => isAuthenticated.value)

defineOptions({
  name: 'SettingsPage',
  components: {
    Tabs
  },
  inheritAttrs: false
})

// 懒加载分区组件（首屏更快）
const GeneralSettings = defineAsyncComponent(
  () => import('./sections/GeneralSettings.vue')
)
const AISettings = defineAsyncComponent(
  () => import('./sections/AISettings.vue')
)
const NotificationSettings = defineAsyncComponent(
  () => import('./sections/NotificationSettings.vue')
)
const ShortcutSettings = defineAsyncComponent(
  () => import('./sections/ShortcutSettings.vue')
)

/** 打开官网订阅页面 */
async function handleOpenSubscriptionPage() {
  try {
    await openWebsiteUrl(websiteUrls.pricing)
  } catch (error) {
    logger.error('Settings', '打开订阅页面失败', error)
  }
}

type TabKey =
  | 'general'
  | 'ai'
  | 'notifications'
  | 'shortcuts'
  | 'subscription'
const tab = ref<TabKey>('general')
const tabs = [
  {
    value: 'general',
    key: 'settings_tab_general',
    fallback: '通用',
    icon: 'settings'
  },
  {
    value: 'ai',
    key: 'settings_tab_ai',
    fallback: 'AI 配置',
    icon: 'sparkles'
  },
  {
    value: 'notifications',
    key: 'settings_tab_notifications',
    fallback: '通知',
    icon: 'bell'
  },
  {
    value: 'shortcuts',
    key: 'settings_tab_shortcuts',
    fallback: '快捷键',
    icon: 'keyboard'
  },
  {
    value: 'subscription',
    key: 'settings_tab_subscription',
    fallback: '计划',
    icon: 'crown'
  }
] as const

function tf(key: string, fallback: string) {
  const v = t(key)
  // 若返回与 key 相同，说明没有命中字典，使用 fallback
  if (!v || v === key) return fallback
  return v
}

const tabsI18n = computed(() =>
  tabs.map(tb => ({
    value: tb.value,
    text: tf(tb.key, tb.fallback),
    icon: tb.icon
  }))
)

// 检查登录状态
async function checkLoginStatus() {
  // Supabase Auth 的 isAuthenticated 是响应式的，会自动更新
}

const allowed = new Set<TabKey>([
  'general',
  'ai',
  'notifications',
  'shortcuts',
  'subscription'
])

function readTabFromURL(): TabKey | null {
  try {
    // 🔒 环境检查：确保在浏览器环境中运行
    if (typeof window === 'undefined') {
      return null
    }
    const url = new URL(window.location.href)
    const q = (url.searchParams.get('tab') || '').toLowerCase()
    if (q && allowed.has(q as TabKey)) return q as TabKey
    const h = (url.hash || '').toLowerCase()
    // 支持 #tab=xxx 或 #/tab/xxx 两种形式（宽松匹配）
    if (h.startsWith('#tab=')) {
      const v = h.slice(5)
      if (allowed.has(v as TabKey)) return v as TabKey
    }
    if (h.startsWith('#/tab/')) {
      const v = h.slice('#/tab/'.length)
      if (allowed.has(v as TabKey)) return v as TabKey
    }
  } catch {}
  return null
}

function writeTabToURL(v: TabKey) {
  try {
    // 🔒 环境检查：确保在浏览器环境中运行
    if (typeof window === 'undefined') {
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set('tab', v)
    // 清理旧的 #tab 片段，统一用查询参数
    if (
      url.hash &&
      (url.hash.startsWith('#tab=') || url.hash.startsWith('#/tab/'))
    ) {
      url.hash = ''
    }
    window.history.replaceState({}, '', url.toString())
  } catch {}
}

function syncFromURL() {
  const t = readTabFromURL()
  if (t && t !== tab.value) tab.value = t
}

let unsubscribeLogin: (() => void) | null = null
let unsubscribeLogout: (() => void) | null = null

// 监听页面可见性变化（当从其他页面返回时刷新状态）
const handleVisibilityChange = () => {
  if (!document.hidden) {
    logger.debug('Settings', 'Visibility', '页面变为可见，重新检查登录状态...')
    checkLoginStatus()
  }
}

onMounted(async () => {
  logger.info('Settings', 'Mount', '页面挂载，开始检查登录状态...')

  // 等待 Supabase Auth 初始化完成（首次加载需要时间）
  await initialize()

  // 检查登录状态
  await checkLoginStatus()

  logger.info('Settings', 'Init', '初始化完成，登录状态', {
    isLoggedIn: isLoggedIn.value,
    isAuthenticated: isAuthenticated.value,
    currentTab: tab.value
  })

  const initial = readTabFromURL()
  if (initial && initial !== tab.value) {
    tab.value = initial
  }

  // 监听浏览器前进/后退
  // 🔒 环境检查：确保在浏览器环境中运行
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', syncFromURL)
    window.addEventListener('hashchange', syncFromURL)
  }

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 监听登录/退出事件
  unsubscribeLogin = onEvent('auth:logged-in', async () => {
    await initialize()
    await checkLoginStatus()
  })

  unsubscribeLogout = onEvent('auth:logged-out', async () => {
    await initialize()
    await checkLoginStatus()
  })
})

onUnmounted(() => {
  // 🔒 环境检查：确保在浏览器环境中运行
  if (typeof window !== 'undefined') {
    window.removeEventListener('popstate', syncFromURL)
    window.removeEventListener('hashchange', syncFromURL)
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (unsubscribeLogin) unsubscribeLogin()
  if (unsubscribeLogout) unsubscribeLogout()
})

watch(tab, v => {
  writeTabToURL(v)
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}

.main-content {
  flex: 1;
  background: var(--color-background);
  overflow: auto;
}

.settings-body {
  display: grid;
  align-items: start;
  gap: var(--spacing-5);
  grid-template-columns: 260px minmax(0, 1fr);
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.settings-sidebar {
  position: sticky;
  top: var(--spacing-4);
  align-self: start;
  padding: var(--spacing-4) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.settings-sidebar :deep(.acuity-tab) {
  margin: var(--spacing-1) 0;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
}

.settings-sidebar :deep(.acuity-tab:hover:not(.acuity-tab--disabled)) {
  background: var(--color-surface-hover);
}

.settings-sidebar :deep(.acuity-tab--active) {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.settings-content {
  min-height: 70vh;
  padding: var(--spacing-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.pane {
  padding: var(--spacing-2) 0;
}

.subscription-redirect {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  min-height: 400px;
  padding: var(--spacing-8);
  text-align: center;
}

.subscription-redirect__icon {
  color: var(--md-sys-color-primary);
}

.subscription-redirect__title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.subscription-redirect__description {
  max-width: 500px;
  margin: 0;
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

/* ✨ Material Web Components 按钮样式 */
.subscription-button {
  --md-sys-color-primary: var(--color-primary);

  /* 使用 Material Design 主题中已定义的 on-primary 颜色 */

  margin-top: var(--spacing-6);
}
</style>
