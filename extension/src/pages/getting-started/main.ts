import { createApp } from 'vue'
import GettingStartedPage from './GettingStarted.vue'
import { bootSelectionToolbar, isSelectionToolbarBooted } from '@/content/selection-toolbar/main'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import { logger } from '@/infrastructure/logging/logger'
import '@/styles/extension-ui.css'

void bootExtensionPage('getting_started').then(() => {
  /** 扩展页无法 executeScript 注入划词脚本；显式 boot 并写入 DOM 供真机探测（跨隔离世界）。 */
  const toolbarOk = bootSelectionToolbar()
  document.documentElement.dataset.yivenoGsToolbar =
    toolbarOk || isSelectionToolbarBooted() ? 'on' : 'off'
  logger.info('Onboarding', 'Getting Started 划词浮层 boot', {
    ok: document.documentElement.dataset.yivenoGsToolbar
  })

  createApp(GettingStartedPage).mount('#app')
})
