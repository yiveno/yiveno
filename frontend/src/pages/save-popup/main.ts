import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './SavePopup.vue'
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
import '@acuity-bookmarks/design-tokens/css/semantic-colors.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'
import { fontService } from '@/application/font/font-service'
import { logger } from '@/infrastructure/logging/logger'
import { preloadMaterialWebComponents } from '@/infrastructure/material/preload-material-web'
import { installMessage } from '@/application/message/install'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

async function initializeSavePopup() {
  installMessage()
  fontService.injectDynamicFontLink()

  try {
    await preloadMaterialWebComponents('SavePopup')
    app.mount('#app')
    logger.info('SavePopup', '🎉 添加书签弹窗启动完成')
  } catch (error) {
    logger.error('SavePopup', '❌ 添加书签弹窗启动失败:', error)
    app.mount('#app')
  }
}

initializeSavePopup()
