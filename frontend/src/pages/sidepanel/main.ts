import { createApp } from 'vue'
import SidePanelPage from './SidePanel.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import '@/styles/extension-ui.css'

applyDocumentLocale({ titleKey: 'page_title_sidepanel' })
createApp(SidePanelPage).mount('#app')
