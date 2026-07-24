import { createApp } from 'vue'
import SettingsPage from './Settings.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'

applyDocumentLocale({ titleKey: 'page_title_settings' })
registerMaterialWebComponents()
createApp(SettingsPage).mount('#app')
