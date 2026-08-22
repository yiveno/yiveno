import { createApp } from 'vue'
import DetailPage from './Detail.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import '@/styles/extension-ui.css'

applyDocumentLocale({ titleKey: 'page_title_detail' })
createApp(DetailPage).mount('#app')
