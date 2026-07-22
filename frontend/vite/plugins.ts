/** Vite 插件配置。 */
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'
import { finalizeExtensionDistPlugin } from './finalize-dist'

/** v4 基础设施阶段：Vue + HTTPS + 扩展 dist 整理。 */
export function createPlugins(): Plugin[] {
  return [vue(), basicSsl(), finalizeExtensionDistPlugin()]
}
