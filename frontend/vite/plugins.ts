/** Vite 插件配置。 */
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'
import { finalizeExtensionDistPlugin } from './finalize-dist'

/** Vue + 本地 HTTPS + 构建后整理扩展 dist 布局。 */
export function createPlugins(): Plugin[] {
  return [vue(), basicSsl(), finalizeExtensionDistPlugin()]
}
