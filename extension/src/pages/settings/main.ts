import { createApp } from 'vue'
import SettingsPage from './Settings.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/extension-ui.css'

bootExtensionPage('settings')
createApp(SettingsPage).mount('#app')
