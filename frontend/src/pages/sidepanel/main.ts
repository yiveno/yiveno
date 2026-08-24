import { createApp } from 'vue'
import SidePanelPage from './SidePanel.vue'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { warnIfCriticalExtensionMessagesMissing } from '@/infrastructure/i18n/validate-critical-extension-messages'
import '@/styles/extension-ui.css'

applyDocumentLocale({ titleKey: 'page_title_sidepanel' })
warnIfCriticalExtensionMessagesMissing()
createApp(SidePanelPage).mount('#app')
