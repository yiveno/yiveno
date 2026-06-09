/**
 * Vite 插件配置
 */

import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { visualizer } from 'rollup-plugin-visualizer'
import { cpSync, existsSync, rmSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import { execSync } from 'child_process'
import { OUT_DIR, ROOT_DIR } from './constants'

/**
 * 在主构建写出 dist 之前生成 auth-sync IIFE，避免 watch 模式下 Chrome 热重载时
 * 仍注入旧版 ES module 的 auth-sync.js。
 */
export function createAuthSyncIifePlugin(): Plugin {
  return {
    name: 'auth-sync-iife',
    apply: 'build',
    enforce: 'pre',
    buildStart() {
      execSync('bun run build:auth-sync', {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development'
        }
      })

      for (const legacyName of ['auth-sync.js', 'auth-sync.js.map']) {
        const legacyPath = resolve(OUT_DIR, legacyName)
        if (existsSync(legacyPath)) {
          unlinkSync(legacyPath)
        }
      }
    }
  }
}

/**
 * 主构建若仍产出 ES module 版 auth-sync.js，在写出前删除（由 clean-dist 重建 IIFE）
 */
export function createStripAuthSyncChunkPlugin(): Plugin {
  return {
    name: 'strip-auth-sync-chunk',
    apply: 'build',
    generateBundle(_options, bundle) {
      delete bundle['auth-sync.js']
      delete bundle['auth-sync.bundle.js']
    }
  }
}

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
        execSync('node scripts/validate-auth-sync.cjs', {
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
 * 构建前校验 Embedding 模型；缺失时才下载（避免每次 build 访问 HuggingFace）
 */
export function createEmbeddingModelPlugin(): Plugin {
  const validateScript = 'bun scripts/validate-embedding-model.mjs'
  const downloadScript = 'bun scripts/download-embedding-model.mjs'

  const run = (command: string, stdio: 'inherit' | 'pipe' = 'inherit') => {
    execSync(command, { cwd: ROOT_DIR, stdio })
  }

  const isModelReady = (): boolean => {
    try {
      run(validateScript, 'pipe')
      return true
    } catch {
      return false
    }
  }

  return {
    name: 'embedding-model',
    apply: 'build',
    enforce: 'pre',
    buildStart() {
      if (isModelReady()) {
        console.log('✅ Embedding 模型已存在，跳过下载')
        return
      }

      console.log('📦 Embedding 模型缺失，开始下载（约 140MB，支持镜像回退）...')
      run(downloadScript)
      run(validateScript)
    }
  }
}

/**
 * 将 public/models 同步到 dist（watch 模式下 Vite 可能不重复复制大文件）
 */
export function createModelsSyncPlugin(): Plugin {
  const modelsSrc = resolve(ROOT_DIR, 'public/models')
  const modelsDest = resolve(OUT_DIR, 'models')

  const syncModels = () => {
    if (!existsSync(modelsSrc)) {
      return
    }
    if (existsSync(modelsDest)) {
      rmSync(modelsDest, { recursive: true, force: true })
    }
    cpSync(modelsSrc, modelsDest, { recursive: true })
  }

  return {
    name: 'sync-models',
    apply: 'build',
    buildStart() {
      syncModels()
    },
    closeBundle() {
      syncModels()
    }
  }
}

/**
 * 将 public/_locales 同步到 dist，避免 watch 只更新 JS 时 chrome.i18n 读不到新 key
 */
export function createLocalesSyncPlugin(): Plugin {
  const localesSrc = resolve(ROOT_DIR, 'public/_locales')
  const localesDest = resolve(OUT_DIR, '_locales')

  const syncLocales = () => {
    if (!existsSync(localesSrc)) {
      return
    }
    if (existsSync(localesDest)) {
      rmSync(localesDest, { recursive: true, force: true })
    }
    cpSync(localesSrc, localesDest, { recursive: true })
  }

  return {
    name: 'sync-locales',
    apply: 'build',
    buildStart() {
      syncLocales()
    },
    handleHotUpdate({ file, server }) {
      if (!file.includes('public/_locales') || !file.endsWith('messages.json')) {
        return
      }
      syncLocales()
      server.ws.send({ type: 'full-reload' })
    }
  }
}

/**
 * 创建所有插件
 */
export function createPlugins() {
  const plugins: Plugin[] = [
    createEmbeddingModelPlugin(),
    createModelsSyncPlugin(),
    createLocalesSyncPlugin(),
    createAuthSyncIifePlugin(),
    createVuePlugin(),
    basicSsl(),
    createServiceWorkerSafePreloadHelperPlugin(),
    createStripAuthSyncChunkPlugin(),
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
