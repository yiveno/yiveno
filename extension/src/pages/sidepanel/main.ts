import { createApp } from 'vue'
import SidePanelPage from './SidePanel.vue'
import { bootExtensionPage } from '@/infrastructure/i18n/extension-i18n-boot'
import '@/styles/extension-ui.css'

void bootExtensionPage('sidepanel').then(() => {
  createApp(SidePanelPage).mount('#app')
})
