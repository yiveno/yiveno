import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './Settings.vue'
import ThemeToggle from '@/components/composite/ThemeToggle/ThemeToggle.vue'

// ✅ 1. 先导入样式（确保 CSS 变量在 Material Web Components 加载前可用）
import '@ottersage/design-tokens/css/material-theme.css'
import '@ottersage/design-tokens/css/variables.css'
import '@ottersage/design-tokens/css/semantic-colors.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'

import { logger } from '@/infrastructure/logging/logger'
import { preloadMaterialWebComponents } from '@/infrastructure/material/preload-material-web'
import { installMessage } from '@/application/message/install'

logger.info('Settings', 'Init', '开始加载 Material Web Components...')

await preloadMaterialWebComponents('Settings')

logger.info('Settings', 'Init', '开始初始化应用...')

// ✅ 安装 Message 组件（全局轻量级提示）
installMessage()

try {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  app.component('ThemeToggle', ThemeToggle)

  // 全局错误处理
  app.config.errorHandler = (err, instance, info) => {
    logger.error('Settings', 'Vue', 'Vue错误', { err, info, instance })
  }

  // 全局警告处理
  app.config.warnHandler = (msg, _instance, trace) => {
    logger.warn('Settings', 'Vue', 'Vue警告', { msg, trace })
  }

  logger.info('Settings', 'Mount', '挂载应用到 #app...')
  app.mount('#app')
  logger.info('Settings', 'Mount', '应用挂载成功')
} catch (error) {
  logger.error('Settings', 'Init', '应用初始化失败', error)
}
