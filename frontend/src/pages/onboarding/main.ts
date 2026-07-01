import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './Onboarding.vue'
// ✅ 导入设计标准（必须在所有样式之前）
import '@yiveno/design-tokens/css/material-theme.css'
import '@yiveno/design-tokens/css/variables.css'
import '@yiveno/design-tokens/css/semantic-colors.css'
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
import { installMessage } from '@/presentation/bootstrap/install-message'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

async function initializeOnboarding() {
  // ✅ 安装 Message 组件（轻量级提示）
  installMessage()

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
