import { createApp } from 'vue'
import DetailPage from './Detail.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/bootstrap-extension-ui'

void bootExtensionPage('detail').then(() => {
  createApp(DetailPage).mount('#app')
})
