import { createApp } from 'vue'
import LibraryPage from './Library.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import '@/styles/extension-ui.css'

applyDocumentLocale({ titleKey: 'page_title_library' })
createApp(LibraryPage).mount('#app')
