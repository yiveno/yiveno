/**
 * TanStack Query Vue Plugin
 *
 * 职责：
 * - 为 Vue 应用安装 Query Client
 * - 提供全局查询功能
 */

import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from './query-client'
import type { App } from 'vue'

/**
 * 安装 TanStack Query 插件到 Vue 应用
 *
 * @param app - Vue 应用实例
 *
 * @example
 * ```typescript
 * import { createApp } from 'vue'
 * import { installQueryClient } from '@/infrastructure/query/plugin'
 *
 * const app = createApp(App)
 * installQueryClient(app)
 * app.mount('#app')
 * ```
 */
export function installQueryClient(app: App) {
  app.use(VueQueryPlugin, {
    queryClient
  })
}

// 导出 queryClient 供其他地方使用
export { queryClient }
