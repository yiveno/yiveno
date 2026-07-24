import { createApp } from 'vue'
import PopupPage from './Popup.vue'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'

registerMaterialWebComponents()
createApp(PopupPage).mount('#app')
