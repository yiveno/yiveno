import { createApp } from 'vue'
import LibraryPage from './Library.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'

applyDocumentLocale({ titleKey: 'page_title_library' })
registerMaterialWebComponents()
createApp(LibraryPage).mount('#app')
