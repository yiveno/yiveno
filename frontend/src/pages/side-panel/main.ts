import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SidePanel from './SidePanel.vue'
// ✅ 导入设计标准（必须在所有样式之前）
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
import '@acuity-bookmarks/design-tokens/css/semantic-colors.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { initializeSmartFonts, fontService } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import { message } from '@/application/message/message-service'
import {
  initializeChromeMessageBridge,
  disposeChromeMessageBridge
} from '@/infrastructure/events/chrome-message-bridge'
import { initCrossPageSync } from '@/composables/useCrossPageSync'
import { preloadMaterialWebComponents } from '@/infrastructure/material/preload-material-web'
import { installMessage } from '@/application/message/install'

logger.debug('SidePanel', 'Init', '恢复完整的初始化逻辑')

const app = createApp(SidePanel)
const pinia = createPinia()

app.use(pinia)
initializeChromeMessageBridge() // 书签变更事件桥接（data:synced 等）

let crossPageCleanup: (() => void) | null = null

// 初始化Side Panel应用
async function initializeSidePanel() {
  installMessage()

  fontService.injectDynamicFontLink()
  try {
    await initializeSmartFonts()
    await preloadMaterialWebComponents('SidePanel')
    app.mount('#app')
    crossPageCleanup = initCrossPageSync()

    logger.info('SidePanel', 'Init', 'AcuityBookmarks Side Panel 启动完成')
    logger.info('SidePanel', 'Mode', '侧边栏模式已激活')
  } catch (error) {
    logger.error('SidePanel', 'Init', 'Side Panel启动失败', error)
    // 不重复 mount — Vue 3 对同一容器 mount 两次会导致不可预期行为
  }
}

initializeSidePanel()

// 页面卸载时清理 Chrome API 监听器，防止 SW 重启后消息发送到失效 context 导致 SIGTRAP
if (typeof window !== 'undefined') {
  window.addEventListener('unload', () => {
    if (crossPageCleanup) {
      try {
        crossPageCleanup()
      } catch {}
      crossPageCleanup = null
      disposeChromeMessageBridge()
    }
  })
}

// 全局替换无确认弹窗
if (typeof window !== 'undefined') {
  const origAlert = window.alert?.bind(window)
  window.alert = (msg?: string | number | boolean | null | undefined) => {
    try {
      message.info(String(msg))
    } catch {}
    if (import.meta.env.DEV && origAlert) origAlert(msg)
  }
}
