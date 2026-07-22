/** Vite 插件配置。 */
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'

/** Vue 自定义元素配置。 */
function createVuePlugin(): Plugin {
  return vue({
    template: {
      compilerOptions: {
        isCustomElement: tag => tag.startsWith('md-')
      }
    }
  })
}

/** v4 基础设施阶段仅保留框架与本地 HTTPS 支持。 */
export function createPlugins(): Plugin[] {
  return [createVuePlugin(), basicSsl()]
}
