import { createApp } from 'vue'
import SettingsPage from './Settings.vue'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'

registerMaterialWebComponents()
createApp(SettingsPage).mount('#app')
