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
        <!-- ✅ Material Web Tabs - 横向布局 -->
        <div class="settings-tabs-container">
          <md-tabs
            :active-tab-index="getActiveTabIndex()"
            @change="handleTabChange"
          >
            <md-primary-tab
              v-for="tabItem in tabsI18n"
              :key="tabItem.value"
            >
              <LucideIcon slot="icon" :name="tabItem.icon" :size="20" />
              {{ tabItem.text }}
            </md-primary-tab>
          </md-tabs>
        </div>

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
import { App, AppHeader, Main } from '@/components'
import '@material/web/tabs/tabs.js'
import '@material/web/tabs/primary-tab.js'
import LucideIcon from '@/components/base/LucideIcon/LucideIcon.vue'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
import { t } from '@/infrastructure'
import { onEvent } from '@/infrastructure/events/event-bus'
import { useSupabaseAuth } from '@/composables'
import { logger } from '@/infrastructure/logging/logger'

// 使用 Supabase Auth 检查登录状态
const { isAuthenticated, initialize } = useSupabaseAuth()
const isLoggedIn = computed(() => isAuthenticated.value)

defineOptions({
  name: 'SettingsPage',
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

type TabKey = 'general' | 'ai' | 'notifications' | 'shortcuts'
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

/**
 * 获取当前激活的 tab 索引
 */
const getActiveTabIndex = (): number => {
  return tabs.findIndex(t => t.value === tab.value)
}

/**
 * 处理 tab 切换
 */
const handleTabChange = (event: Event) => {
  const target = event.target as HTMLElement & { activeTabIndex: number }
  const index = target.activeTabIndex
  if (index >= 0 && index < tabs.length) {
    tab.value = tabs[index].value
  }
}

// 检查登录状态
async function checkLoginStatus() {
  // Supabase Auth 的 isAuthenticated 是响应式的，会自动更新
}

const allowed = new Set<TabKey>(['general', 'ai', 'notifications', 'shortcuts'])

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
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

/* ========================================
 * Material Web Tabs 样式配置
 * ======================================== */
.settings-tabs-container {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: var(--spacing-4) 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
}

md-tabs {
  --md-primary-tab-active-indicator-height: 3px;
  --md-primary-tab-container-height: 56px;
  --md-primary-tab-label-text-size: var(--text-base);
  --md-icon-size: 20px;

  width: 100%;
}

.settings-content {
  min-height: 70vh;
  padding: var(--spacing-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  
  /* ✅ Material Design 3 Elevation Level 1 */
  box-shadow: var(--md-sys-elevation-1);
}

.pane {
  padding: var(--spacing-2) 0;
}
</style>
