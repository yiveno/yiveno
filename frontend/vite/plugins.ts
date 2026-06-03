/**
 * Vite 插件配置
 */

import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { visualizer } from 'rollup-plugin-visualizer'
import type { Plugin } from 'vite'
import { execSync } from 'child_process'
import { ROOT_DIR } from './constants'

/**
 * Vue 插件配置
 */
export function createVuePlugin() {
  return vue({
    template: {
      compilerOptions: {
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
        execSync('node scripts/validate-background.cjs', {
          stdio: 'inherit',
          cwd: ROOT_DIR
        })
      } catch (error) {
        console.error('❌ 清理脚本执行失败:', error)
        throw error
      }
    }
  }
}

/**
 * 修复 Rolldown/Vite 注入的动态导入 helper 在 Service Worker 中访问 window 的问题
 */
export function createServiceWorkerSafePreloadHelperPlugin(): Plugin {
  return {
    name: 'service-worker-safe-preload-helper',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        if (!chunk.code.includes('window.dispatchEvent')) continue
        chunk.code = chunk.code.replaceAll(
          'window.dispatchEvent(e)',
          'globalThis.dispatchEvent?.(e)'
        )
      }
    }
  }
}

/**
 * 创建所有插件
 */
export function createPlugins() {
  const plugins: Plugin[] = [
    createVuePlugin(),
    basicSsl(),
    createServiceWorkerSafePreloadHelperPlugin(),
    createCleanDistPlugin()
  ]

  if (process.env.ANALYZE === 'true') {
    plugins.push(
      // @ts-expect-error - Rollup plugin type incompatible with Vite 8
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap'
      })
    )
  }

  return plugins
}
