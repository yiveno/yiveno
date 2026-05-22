/**
 * Vite 插件配置
 *
 * 注意：虽然 Vite 8 使用 Rolldown 替代了 Rollup，
 * 但 rollup-plugin-visualizer 仍然兼容（Rolldown 保持了 Rollup 插件 API 兼容性）
 */

import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { visualizer } from 'rollup-plugin-visualizer'
import type { Plugin } from 'vite'
import { execSync } from 'child_process'
import { HTTPS_ENV_VARS, ROOT_DIR } from './constants'

/**
 * 强制将 HTTP URL 转换为 HTTPS
 */
export function forceHttpsEnvVars(env: Record<string, string>) {
  HTTPS_ENV_VARS.forEach(key => {
    const value = env[key] || process.env[key]
    if (value?.startsWith('http://')) {
      const httpsValue = value.replace('http://', 'https://')
      // 更新 process.env（Vite 会从这里读取）
      process.env[key] = httpsValue
      // 更新 env 对象
      env[key] = httpsValue
      console.warn(`⚠️  构建时转换: ${key} 从 HTTP 转换为 HTTPS: ${value} → ${httpsValue}`)
    }
  })
}

/**
 * Vue 插件配置
 */
export function createVuePlugin() {
  return vue({
    template: {
      compilerOptions: {
        // ✨ 识别 Material Web Components 自定义元素
        // 所有以 md- 开头的标签都被视为自定义元素，不会触发 Vue 组件解析警告
        isCustomElement: tag => tag.startsWith('md-')
      }
    }
  })
}

/**
 * 清理 dist 目录插件
 */
export function createCleanDistPlugin(): Plugin {
  return {
    name: 'clean-dist-plugin',
    closeBundle() {
      console.log('🧹 构建完成，运行清理脚本...')
      try {
        execSync('bun scripts/clean-dist.cjs', {
          stdio: 'inherit',
          cwd: ROOT_DIR
        })
        // ✅ 构建后验证 background.js 不包含 DOM API
        execSync('node scripts/validate-background.cjs', {
          stdio: 'inherit',
          cwd: ROOT_DIR
        })
      } catch (error) {
        console.error('❌ 清理脚本执行失败:', error)
      }
    }
  }
}

/**
 * 强制 HTTPS 环境变量插件
 */
export function createForceHttpsPlugin(): Plugin {
  return {
    name: 'force-https-env-vars',
    configResolved(config: { env: Record<string, string> }) {
      // 在配置解析后，再次检查并转换环境变量
      HTTPS_ENV_VARS.forEach(key => {
        const value = process.env[key]
        if (value?.startsWith('http://')) {
          const httpsValue = value.replace('http://', 'https://')
          process.env[key] = httpsValue
          // 同时更新 config.env 中的值
          if (config.env[key]) {
            config.env[key] = httpsValue
          }
          console.warn(`⚠️  插件转换: ${key} 从 HTTP 转换为 HTTPS: ${value} → ${httpsValue}`)
        }
      })
    }
  }
}

/**
 * 创建所有插件
 */
export function createPlugins() {
  const plugins: Plugin[] = [
    createVuePlugin(),
    // 🔒 启用 HTTPS 开发服务器
    basicSsl(),
    // 🧹 构建完成后自动清理和整理 dist 目录
    createCleanDistPlugin(),
    // 🔒 强制 HTTPS 环境变量
    createForceHttpsPlugin()
  ]

  // 📊 打包体积分析（ANALYZE=true 时启用）
  if (process.env.ANALYZE === 'true') {
    plugins.push(
      // @ts-expect-error - Rollup 插件类型与 Vite 插件类型不完全兼容
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap' // 可选: 'sunburst', 'treemap', 'network'
      })
    )
  }

  return plugins
}
