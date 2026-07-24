import { createApp } from 'vue'
import DetailPage from './Detail.vue'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'

registerMaterialWebComponents()
createApp(DetailPage).mount('#app')
