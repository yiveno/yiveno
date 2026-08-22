import { createApp } from 'vue'
import SettingsPage from './Settings.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import '@/styles/extension-ui.css'

applyDocumentLocale({ titleKey: 'page_title_settings' })
createApp(SettingsPage).mount('#app')
