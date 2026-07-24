/** Vite 插件配置。 */
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'
import { contentScriptsIifePlugin } from './content-scripts-iife'
import { finalizeExtensionDistPlugin } from './finalize-dist'

/** Vue + 本地 HTTPS + content script IIFE + 整理扩展 dist。 */
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
    contentScriptsIifePlugin(),
    finalizeExtensionDistPlugin()
  ]
}
