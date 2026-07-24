import { createApp } from 'vue'
import LibraryPage from './Library.vue'
import { registerMaterialWebComponents } from '@/infrastructure/ui/register-material-web'
import '@/styles/material-ui.css'

registerMaterialWebComponents()
createApp(LibraryPage).mount('#app')
