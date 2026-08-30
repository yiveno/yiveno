import { createApp } from 'vue'
import DetailPage from './Detail.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/extension-ui.css'

bootExtensionPage('detail')
createApp(DetailPage).mount('#app')
