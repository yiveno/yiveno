import { createApp } from 'vue'
import GettingStartedPage from './GettingStarted.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'
// 扩展页无法经 manifest / executeScript 注入 content script，直接打入本页 bundle。
import '@/content/selection-toolbar/main'

applyDocumentLocale({ titleKey: 'page_title_getting_started' })
registerMaterialWebComponents()
createApp(GettingStartedPage).mount('#app')
