<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { AppHeader, Card } from '@/components'
import LucideIcon from '@/components/base/LucideIcon/LucideIcon.vue'
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
import { t } from '@/infrastructure'
import { onEvent } from '@/infrastructure/events/event-bus'
import { useSupabaseAuth, useThemeSync } from '@/composables'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({
  name: 'SettingsPage',
  inheritAttrs: false
})
// 使用 Supabase Auth 检查登录状态
const { isAuthenticated, initialize, setupAuthListener } = useSupabaseAuth()
const isLoggedIn = computed(() => isAuthenticated.value)

// 懒加载分区组件（首屏更快）
const GeneralSettings = defineAsyncComponent(
  () => import('./sections/GeneralSettings.vue')
)
const ColorPresetSettings = defineAsyncComponent(
  () => import('./sections/ColorPresetSettings.vue')
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

type TabKey = 'general' | 'colorPreset' | 'ai' | 'notifications' | 'shortcuts'
const tab = ref<TabKey>('general')
const tabs = [
  {
    value: 'general',
    key: 'settings_tab_general',
    fallback: '通用',
    icon: 'settings'
  },
  {
    value: 'colorPreset',
    key: 'settings_tab_color_preset',
    fallback: '配色',
    icon: 'palette'
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

/** 与 `md-tabs.activeTabIndex` 对齐的当前索引（Material Web 使用 0-based） */
const tabsActiveIndex = computed(() => {
  const i = tabs.findIndex(tabItem => tabItem.value === tab.value)
  return i >= 0 ? i : 0
})

/** 当前 tab 的标题 */
const currentTabTitle = computed(() => {
  const currentTab = tabs.find(tabItem => tabItem.value === tab.value)
  return currentTab ? tf(currentTab.key, currentTab.fallback) : ''
})

/** 当前 tab 的图标 */
const currentTabIcon = computed(() => {
  const currentTab = tabs.find(tabItem => tabItem.value === tab.value)
  return currentTab?.icon || 'settings'
})

const mdTabsRef = ref<HTMLElement | null>(null)

/**
 * 将 Vue 状态同步到 Lit `md-tabs`（仅靠模板绑定时，部分情况下指示器与选中态不会更新）。
 */
function syncMdTabsActiveIndex(): void {
  const el = mdTabsRef.value as { activeTabIndex?: number } | null
  if (!el || typeof el.activeTabIndex !== 'number') return
  const next = tabsActiveIndex.value
  if (el.activeTabIndex !== next) {
    el.activeTabIndex = next
  }
}

/**
 * 处理 tab 切换：`change` 可能从子节点冒泡，必须用 `currentTarget` 取 `md-tabs`。
 */
function handleTabChange(event: Event): void {
  const host = event.currentTarget as HTMLElement & { activeTabIndex: number }
  const index = host.activeTabIndex
  if (index >= 0 && index < tabs.length) {
    tab.value = tabs[index].value
  }
}

// 检查登录状态
async function checkLoginStatus() {
  // Supabase Auth 的 isAuthenticated 是响应式的，会自动更新
}

const allowed = new Set<TabKey>([
  'general',
  'colorPreset',
  'ai',
  'notifications',
  'shortcuts'
])

useThemeSync('Settings')

function readTabFromURL(): TabKey | null {
  try {
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
  const tabFromURL = readTabFromURL()
  if (tabFromURL && tabFromURL !== tab.value) tab.value = tabFromURL
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
  setupAuthListener() // ✅ 手动设置认证状态监听器

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

  await nextTick()
  syncMdTabsActiveIndex()

  // 监听浏览器前进/后退
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
  void nextTick(() => syncMdTabsActiveIndex())
})
</script>

<template>
  <div class="settings-page app-container">
    <GlobalSyncProgress />

    <GlobalQuickAddBookmark />

    <AppHeader
      :show-side-panel-toggle="false"
      :show-settings="false"
      :show-account="false"
    />
    <main class="main-content">
      <div class="settings-body">
        <!-- ✅ Material Web Tabs - 横向布局 -->
        <div class="settings-tabs-container">
          <md-tabs
            ref="mdTabsRef"
            class="settings-md-tabs"
            :active-tab-index="tabsActiveIndex"
            @change="handleTabChange"
          >
            <md-primary-tab
              v-for="tabItem in tabsI18n"
              :key="tabItem.value"
              class="settings-md-primary-tab"
            >
              <!-- 原生元素承载 slot，保证投射进 md-primary-tab 的 icon 槽，避免 Vue 组件根节点无法插槽导致重叠与 ? 占位 -->
              <span slot="icon" class="settings-tab__icon-slot">
                <LucideIcon :name="tabItem.icon" :size="20" />
              </span>
              <span class="settings-tab__label">{{ tabItem.text }}</span>
            </md-primary-tab>
          </md-tabs>
        </div>

        <Card variant="default" class="settings-content" role="region">
          <template #header>
            <div class="settings-card-header">
              <LucideIcon :name="currentTabIcon" :size="20" />
              <span>{{ currentTabTitle }}</span>
            </div>
          </template>

          <component
            :is="tab === 'general' ? GeneralSettings : 
                 tab === 'colorPreset' ? ColorPresetSettings : 
                 tab === 'ai' ? AISettings : 
                 tab === 'notifications' ? NotificationSettings : 
                 ShortcutSettings"
            class="pane"
          />
        </Card>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}

.main-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  box-sizing: border-box; /* padding 不会导致溢出 */
  min-height: 0; /* 允许 flex 子元素收缩 */
  background: var(--color-background);
  overflow: hidden; /* 页面层级不出现滚动条 */
}

.settings-body {
  display: flex;
  flex-direction: column;
  flex: 1; /* 填满父容器 */
  gap: var(--spacing-4);
  box-sizing: border-box; /* padding 不会导致溢出 */
  width: 100%; /* 确保宽度正确 */
  max-width: 1200px;
  min-height: 0; /* 允许 flex 子元素收缩 */
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

  /* 不与下方内容区 `border-top` 叠成双横线：分隔由 `.settings-content` 外框承担 */
  background: var(--color-background);
}

.settings-md-tabs {
  --md-primary-tab-active-indicator-height: 3px;
  --md-primary-tab-container-height: 56px;
  --md-primary-tab-label-text-size: var(--text-base);
  --md-icon-size: 20px;

  display: block;
  width: 100%;
  min-height: 56px;
}

/* 子节点在 Shadow 外：用 :deep 拉平各 Tab 的最小宽度与图标对齐，避免标签挤成一团 */
.settings-tabs-container :deep(md-primary-tab.settings-md-primary-tab) {
  flex: 1 1 0;
  min-width: 4.5rem;
  max-width: none;
}

.settings-tab__icon-slot {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 1.25rem;
  height: 1.25rem;
}

.settings-tab__label {
  white-space: nowrap;
}

.settings-content {
  display: flex;
  flex-direction: column;
  flex: 1; /* 填满剩余空间 */
  min-height: 0; /* 允许 flex 子元素收缩 */
}

.settings-card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

/* Card body 已经有 overflow-y: auto，这里不需要额外设置 */

/* section 组件的内容会在 Card body 中滚动 */

.pane {
}
</style>
