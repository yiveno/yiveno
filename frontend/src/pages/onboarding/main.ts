import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './Onboarding.vue'
// ✅ 导入设计标准（必须在所有样式之前）
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
import '@acuity-bookmarks/design-tokens/css/semantic-colors.css'
// ❌ 移除自定义 tokens（违反设计标准）
// import '@/design-system/tokens.css'
// import '@/design-system/typography.css'
// import '@/design-system/base.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { initializeSmartFonts, fontService } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import { preloadMaterialWebComponents } from '@/infrastructure/material/preload-material-web'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
// 旧 Icon 组件已移除，使用 LucideIcon 替代

async function initializeOnboarding() {
  fontService.injectDynamicFontLink()
  try {
    await initializeSmartFonts()
    await preloadMaterialWebComponents('Onboarding')
    app.mount('#app')
    logger.info('Onboarding', '🎉 引导页启动完成')
  } catch (error) {
    logger.error('Onboarding', '❌ 引导页启动失败:', error)
    app.mount('#app')
  }
}

initializeOnboarding()
