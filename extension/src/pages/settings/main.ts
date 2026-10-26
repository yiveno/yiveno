import { createApp } from 'vue'
import SettingsPage from './Settings.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/extension-ui.css'

void bootExtensionPage('settings').then(() => {
  createApp(SettingsPage).mount('#app')
})
