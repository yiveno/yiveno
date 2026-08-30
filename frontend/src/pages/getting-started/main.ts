import { createApp } from 'vue'
import GettingStartedPage from './GettingStarted.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/extension-ui.css'
// 扩展页无法经 manifest / executeScript 注入 content script，直接打入本页 bundle。
import '@/content/selection-toolbar/main'

bootExtensionPage('getting_started')
createApp(GettingStartedPage).mount('#app')
