/**
 * DEV-only Probe Console 入口。生产构建不包含本页。
 * UI / 语料在 `@yiveno/probe`；本页仅挂载 + 扩展样式。
 */

import { createApp, type Component } from 'vue'
import { ProbeConsole } from '@yiveno/probe/console'
import '@/styles/extension-ui.css'

createApp(ProbeConsole as Component).mount('#app')
