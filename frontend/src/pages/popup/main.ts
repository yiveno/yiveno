import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import Popup from './Popup.vue'
// ✅ 导入设计标准（必须在所有样式之前）
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
import '@acuity-bookmarks/design-tokens/css/semantic-colors.css'
// 样式导入（main.css 已包含完整设计系统：layers + tokens + typography + base + utilities）
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { logger } from '@/infrastructure/logging/logger'
import { message } from '@/application/message/message-service'
import { performanceMonitor } from '@/utils/performance-monitor'
import { preloadMaterialWebComponents } from '@/infrastructure/material/preload-material-web'
import { installMessage } from '@/application/message/install'

// 懒加载字体服务和跨页面同步
const loadFontService = () => import('@/application/font/font-service')
const loadCrossPageSync = () => import('@/composables/useCrossPageSync')

/**
 * Popup 页面根应用实例。
 */
const app = createApp(Popup)
/**
 * Popup 页面使用的 Pinia 实例。
 */
const pinia = createPinia()

app.use(pinia)
app.use(VueQueryPlugin)

/**
 * 初始化并挂载 Popup 应用，确保字体资源加载完成。
 */
async function initializePopup(): Promise<void> {
  const startTime = performance.now()

  // 启动性能监控
  performanceMonitor.initialize()

  try {
    // ✅ 1. 安装 Message 组件（全局轻量级提示）
    installMessage()

    // ✅ 2. 先加载 Material Web 组件（确保在 Vue 组件渲染前注册）
    await preloadMaterialWebComponents('Popup')

    // 3. 懒加载字体服务
    const { fontService, initializeSmartFonts } = await loadFontService()

    fontService.injectDynamicFontLink()

    // 启动基础字体系统（用户界面语言）
    await initializeSmartFonts()

    // 启动智能字体系统（用户内容自动检测）
    initializeSmartFonts()

    // 字体加载已由 Service Worker 统一预取和缓存，无需页面单独请求

    // 4. 挂载应用
    app.mount('#app')

    // ✅ 初始化跨页面同步（需在 Pinia 安装后调用）
    // 懒加载，避免阻塞首屏
    const { initCrossPageSync } = await loadCrossPageSync()
    initCrossPageSync()

    const loadTime = performance.now() - startTime
    logger.info('Popup', `🎉 AcuityBookmarks Popup 启动完成 (${loadTime.toFixed(2)}ms)`)
    logger.info('Popup', '🧠 智能多语言字体系统已激活')

    // 打印性能报告（延迟执行，避免阻塞）
    setTimeout(() => {
      performanceMonitor.printReport()
    }, 2000)
  } catch (error) {
    logger.error('Popup', '❌ Popup启动失败:', error)

    // 即使字体初始化失败，也要启动应用
    app.mount('#app')
  }
}

initializePopup()

// 全局替换无确认弹窗
// 仅限无需确认的提示，尽量不要用于错误阻断流程
if (typeof window !== 'undefined') {
  const origAlert = window.alert?.bind(window)
  window.alert = (msg?: string | number | boolean | null | undefined) => {
    try {
      message.info(String(msg))
    } catch {
      /* ignore */
    }
    if (import.meta.env.DEV && origAlert) origAlert(msg)
  }
}
