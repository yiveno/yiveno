/**
 * Vite 开发服务器配置
 */

import type { ServerOptions } from 'vite'

/**
 * 创建开发服务器配置
 */
export function createServerConfig(): ServerOptions {
  return {
    // 🔒 HTTPS 由 basicSsl() 插件自动配置
    // basicSsl() 插件会自动生成自签名证书并配置 HTTPS
    hmr: {
      overlay: false, // 关闭错误覆盖层，提升开发体验
      protocol: 'ws',
      timeout: 30000
    },
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
    },
    fs: {
      strict: false
    }
  }
}
