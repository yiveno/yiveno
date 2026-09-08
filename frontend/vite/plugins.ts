/** Vite 插件配置。 */
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'
import { extensionPostBuildPlugin } from './extension-post-build'
import { swSafeModulePreloadPlugin } from './sw-safe-modulepreload'

/** Vue + 本地 HTTPS + 扩展收尾（content IIFE + 平铺 dist，watch 互斥）。 */
export function createPlugins(): Plugin[] {
  return [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('md-')
        }
      }
    }),
    basicSsl(),
    swSafeModulePreloadPlugin(),
    extensionPostBuildPlugin()
  ]
}
