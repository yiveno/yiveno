import { createApp } from 'vue'
import SidePanelPage from './SidePanel.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/bootstrap-extension-ui'

void bootExtensionPage('sidepanel').then(() => {
  createApp(SidePanelPage).mount('#app')
})
