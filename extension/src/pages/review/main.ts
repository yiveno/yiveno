import { createApp } from 'vue'
import ReviewPage from './ReviewPage.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/bootstrap-extension-ui'

void bootExtensionPage('review').then(() => {
  createApp(ReviewPage).mount('#app')
})
