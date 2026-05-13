import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Management from './Management.vue'
// ✅ 导入设计标准（必须在所有样式之前）
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
import '@acuity-bookmarks/design-tokens/css/semantic-colors.css'
import '@/assets/main.css' // Import shared styles
import '@/assets/fonts.css' // Import font system
import '@/assets/smart-fonts.css' // Import smart font system
import { notifyInfo } from '@/application/notification/notification-service'
import { installQueryClient } from '@/infrastructure/query/plugin'
import { initializeChromeMessageBridge } from '@/infrastructure/events/chrome-message-bridge'
import { logger } from '@/infrastructure/logging/logger'
import { performanceMonitor } from '@/utils/performance-monitor'

// 懒加载字体服务、跨页面同步和收藏服务
const loadFontService = () => import('@/application/font/font-service')
const loadCrossPageSync = () => import('@/composables/useCrossPageSync')
const loadFavoriteService = () => import('@/application/bookmark/favorite-app-service')

const app = createApp(Management)
const pinia = createPinia()

app.use(pinia)
installQueryClient(app) // 🆕 安装 TanStack Query
initializeChromeMessageBridge() // 🆕 初始化事件桥接

// 初始化应用
async function initializeApp() {
  const startTime = performance.now()
  
  // 启动性能监控
  performanceMonitor.initialize()
  
  try {
    // 懒加载字体服务
    const { fontService, initializeSmartFonts } = await loadFontService()
    
    fontService.injectDynamicFontLink()
    
    // 启动基础字体系统（用户界面语言）
    await initializeSmartFonts()

    // 启动智能字体系统（用户内容自动检测）
    initializeSmartFonts()

    // 字体加载已由 Service Worker 统一预取和缓存，无需页面单独请求

    // 挂载应用（优先显示 UI）
    app.mount('#app')

    // ✅ 初始化跨页面同步（需在 Pinia 安装后调用）
    // 懒加载，避免阻塞首屏
    const { initCrossPageSync } = await loadCrossPageSync()
    initCrossPageSync()

    // ✅ 同步收藏数据（IndexedDB ↔ chrome.storage.local）
    // 在页面打开时执行，避免在 Service Worker 中触发 DOM API
    // 延迟执行，避免阻塞首屏
    setTimeout(async () => {
      try {
        const { favoriteAppService } = await loadFavoriteService()
        await favoriteAppService.syncFavoriteData()
        logger.info('Management', 'Init', '✅ 收藏数据同步完成')
      } catch (syncError) {
        logger.warn('Management', 'Init', '收藏数据同步失败（非致命错误）', syncError)
      }
    }, 1000)

    const loadTime = performance.now() - startTime
    logger.info('Management', 'Init', `AcuityBookmarks 管理页面启动完成 (${loadTime.toFixed(2)}ms)`)
    logger.info('Management', 'Font', '智能多语言字体系统已激活')
    
    // 打印性能报告（延迟执行，避免阻塞）
    setTimeout(() => {
      performanceMonitor.printReport()
    }, 3000)
  } catch (error) {
    logger.error('Management', 'Init', '应用启动失败', error)

    // 即使字体初始化失败，也要启动应用
    app.mount('#app')
  }
}

initializeApp()

// 全局替换无确认弹窗
if (typeof window !== 'undefined') {
  const origAlert = window.alert?.bind(window)
  window.alert = (msg?: string | number | boolean | null | undefined) => {
    try {
      notifyInfo(String(msg))
    } catch {}
    if (import.meta.env.DEV && origAlert) origAlert(msg)
  }
}
