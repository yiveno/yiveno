import { createApp } from 'vue'
import DetailPage from './Detail.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'

applyDocumentLocale({ titleKey: 'page_title_detail' })
registerMaterialWebComponents()
createApp(DetailPage).mount('#app')
