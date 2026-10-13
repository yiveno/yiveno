import { createApp } from 'vue'
import LibraryPage from './Library.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/extension-ui.css'

bootExtensionPage('library')
createApp(LibraryPage).mount('#app')
