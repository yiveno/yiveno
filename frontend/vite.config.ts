/**
 * Vite 配置主入口
 */

import { defineConfig } from 'vite'
import { resolve } from 'path'
import { PROJECT_ROOT, SRC_DIR, logBuildConfig } from './vite/constants'
import { createPlugins } from './vite/plugins'
import { createBuildConfig } from './vite/build'
import { createServerConfig } from './vite/server'

export default defineConfig(({ mode }) => {
  logBuildConfig()

  const probeConsoleEntry = resolve(SRC_DIR, 'dev/probe-console/index.html')
  const pageEntries = [
    resolve(SRC_DIR, 'pages/sidepanel/index.html'),
    resolve(SRC_DIR, 'pages/settings/index.html'),
    resolve(SRC_DIR, 'pages/detail/index.html'),
    resolve(SRC_DIR, 'pages/library/index.html'),
    resolve(SRC_DIR, 'pages/getting-started/index.html'),
    ...(mode !== 'production' ? [probeConsoleEntry] : [])
  ]

  const prodDevStubs =
    mode === 'production'
      ? {
          '@/dev/probe/debug-dev-handler': resolve(
            SRC_DIR,
            'dev/probe/debug-dev-handler.prod-stub.ts'
          ),
          '@/dev/probe/expose-recall-probe-seed-debug': resolve(
            SRC_DIR,
            'dev/probe/expose-recall-probe-seed-debug.prod-stub.ts'
          ),
          '@/infrastructure/debug/expose-clue-gateway-debug': resolve(
            SRC_DIR,
            'infrastructure/debug/expose-clue-gateway-debug.prod-stub.ts'
          ),
          '@/infrastructure/debug/expose-memory-dev-debug': resolve(
            SRC_DIR,
            'infrastructure/debug/expose-memory-dev-debug.prod-stub.ts'
          ),
          '@/infrastructure/debug/expose-recall-telemetry-debug': resolve(
            SRC_DIR,
            'infrastructure/debug/expose-recall-telemetry-debug.prod-stub.ts'
          )
        }
      : {}

  return {
    base: './',
    // 仅由 clean-dist 拷贝白名单资产，避免 public/models 等历史残留进入 dist
    publicDir: false as const,
    envDir: resolve(PROJECT_ROOT, '.env.runtime'),
    plugins: createPlugins(),
    resolve: {
      alias: {
        '@': SRC_DIR,
        '@yiveno/probe/console': resolve(
          PROJECT_ROOT,
          'packages/yiveno-probe/src/console/index.ts'
        ),
        '@yiveno/probe': resolve(PROJECT_ROOT, 'packages/yiveno-probe/src/index.ts'),
        ...prodDevStubs
      }
    },

    build: createBuildConfig(mode),

    optimizeDeps: {
      entries: pageEntries,
      include: ['vue'],
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
