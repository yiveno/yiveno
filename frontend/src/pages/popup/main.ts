import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import Popup from './Popup.vue'
import '@ottersage/design-tokens/css/material-theme.css'
import '@ottersage/design-tokens/css/variables.css'
import '@ottersage/design-tokens/css/semantic-colors.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { logger } from '@/infrastructure/logging/logger'
import { message } from '@/application/message/message-service'
import { performanceMonitor } from '@/utils/performance-monitor'
import { preloadMaterialWebComponents } from '@/infrastructure/material/preload-material-web'
import { installMessage } from '@/application/message/install'

const app = createApp(Popup)
const pinia = createPinia()

app.use(pinia)
app.use(VueQueryPlugin)

/** 全局替换 alert 为轻量 message 提示（非阻断流程） */
function patchWindowAlert(): void {
  const origAlert = window.alert?.bind(window)
  window.alert = (msg?: unknown) => {
    try {
      message.info(String(msg))
    } catch {
      /* ignore */
    }
    if (import.meta.env.DEV && origAlert) origAlert(msg)
  }
}

async function initializePopup(): Promise<void> {
  const startTime = performance.now()
  performanceMonitor.initialize()

  try {
    installMessage()
    await preloadMaterialWebComponents('Popup')

    const [{ fontService, initializeSmartFonts }, { initCrossPageSync }] = await Promise.all([
      import('@/application/font/font-service'),
      import('@/composables/useCrossPageSync')
    ])

    fontService.injectDynamicFontLink()
    await initializeSmartFonts()
    initializeSmartFonts()

    app.mount('#app')
    initCrossPageSync()

    const loadTime = performance.now() - startTime
    logger.info('Popup', `🎉 otterSage Popup 启动完成 (${loadTime.toFixed(2)}ms)`)
    logger.info('Popup', '🧠 智能多语言字体系统已激活')

    setTimeout(() => performanceMonitor.printReport(), 2000)
  } catch (error) {
    logger.error('Popup', '❌ Popup启动失败:', error)
    app.mount('#app')
  }
}

patchWindowAlert()
initializePopup()
