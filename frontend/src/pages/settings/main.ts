import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './Settings.vue'
import ThemeToggle from '@/components/composite/ThemeToggle/ThemeToggle.vue'

// ✅ 1. 先导入样式（确保 CSS 变量在 Material Web Components 加载前可用）
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
import '@acuity-bookmarks/design-tokens/css/semantic-colors.css'
import '@/assets/main.css'
import '@/assets/fonts.css'
import '@/assets/smart-fonts.css'

import { logger } from '@/infrastructure/logging/logger'

// ✅ 2. 再加载 Material Web Components（样式已就绪）
// ⚠️ 重要：必须使用动态导入确保副作用执行，否则 Vite tree-shaking 会移除依赖组件

async function loadMaterialComponents() {
  // 先加载依赖组件（ripple, focus-ring, elevation）
  await Promise.all([
    import('@material/web/ripple/ripple.js'),
    import('@material/web/focus/md-focus-ring.js'),
    import('@material/web/elevation/elevation.js')
  ])
  
  // 再加载所有需要的组件
  const [
    { MdFilledButton },
    { MdOutlinedButton },
    { MdTextButton },
    { MdIcon },
    { MdSwitch },
    { MdFilledSelect },
    { MdSelectOption }
  ] = await Promise.all([
    import('@material/web/button/filled-button.js'),
    import('@material/web/button/outlined-button.js'),
    import('@material/web/button/text-button.js'),
    import('@material/web/icon/icon.js'),
    import('@material/web/switch/switch.js'),
    import('@material/web/select/filled-select.js'),
    import('@material/web/select/select-option.js')
  ])
  
  return { MdFilledButton, MdOutlinedButton, MdTextButton, MdIcon, MdSwitch, MdFilledSelect, MdSelectOption }
}

logger.info('Settings', 'Init', '开始加载 Material Web Components...')

// 等待 Material Web Components 加载完成
const materialComponents = await loadMaterialComponents()

if (typeof customElements !== 'undefined') {
  logger.info('Settings', 'Material Web', 'Components loaded', {
    count: Object.keys(materialComponents).length,
    'md-ripple': !!customElements.get('md-ripple'),
    'md-focus-ring': !!customElements.get('md-focus-ring'),
    'md-elevation': !!customElements.get('md-elevation'),
    'md-filled-button': !!customElements.get('md-filled-button'),
    'md-switch': !!customElements.get('md-switch'),
    'md-filled-select': !!customElements.get('md-filled-select'),
    'md-select-option': !!customElements.get('md-select-option')
  })
}

logger.info('Settings', 'Init', '开始初始化应用...')

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
