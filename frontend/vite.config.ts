/**
 * Vite 配置主入口
 */

import { defineConfig } from 'vite'
import { resolve } from 'path'
import { PROJECT_ROOT, SRC_DIR, logBuildConfig } from './vite/constants'
import { createPlugins } from './vite/plugins'
import { createBuildConfig } from './vite/build'
import { createServerConfig } from './vite/server'

export default defineConfig(() => {
  logBuildConfig()

  return {
    base: './',
    envDir: resolve(PROJECT_ROOT, '.env.runtime'),
    plugins: createPlugins(),
    resolve: {
      alias: {
        '@': SRC_DIR
      }
    },

    build: createBuildConfig(),

    optimizeDeps: {
      entries: [
        resolve(SRC_DIR, 'pages/popup/index.html'),
        resolve(SRC_DIR, 'pages/management/index.html'),
        resolve(SRC_DIR, 'pages/side-panel/index.html'),
        resolve(SRC_DIR, 'pages/settings/index.html'),
        resolve(SRC_DIR, 'pages/onboarding/index.html')
      ],
      include: [
        'vue',
        'pinia',
        'flexsearch',
        '@tanstack/vue-virtual',
        '@vueuse/core',
        'immer',
        'mitt',
        'zod',
        '@material/web'
      ],
      exclude: [
        '@huggingface/transformers',
        'qrcode'
      ],
      force: false,
      holdUntilCrawlEnd: true
    },

    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false
    },

    worker: {
      format: 'es' as const
    },

    server: createServerConfig()
  }
})
