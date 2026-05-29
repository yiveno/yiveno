/**
 * Vite 配置主入口
 *
 * 配置模块化拆分：
 * - vite/constants.ts - 常量定义
 * - vite/plugins.ts - 插件配置
 * - vite/build.ts - 构建配置
 * - vite/build-options.ts - 构建选项配置（输入、分包、输出）
 * - vite/server.ts - 开发服务器配置
 */

import { defineConfig, type ConfigEnv, loadEnv } from 'vite'
import { resolve } from 'path'
import { PROJECT_ROOT, SRC_DIR, logBuildConfig } from './vite/constants'
import { createPlugins, forceHttpsEnvVars } from './vite/plugins'
import { createBuildConfig } from './vite/build'
import { createServerConfig } from './vite/server'

// https://vitejs.dev/config/
export default defineConfig((_env: ConfigEnv) => {
  // 🔒 使用 loadEnv 读取环境变量，并强制将 HTTP URL 转换为 HTTPS
  // 确保 import.meta.env 中的 URL 始终是 HTTPS
  const env = loadEnv(_env.mode, PROJECT_ROOT, '')

  // 在配置加载前执行转换
  forceHttpsEnvVars(env)

  // 打印构建配置
  logBuildConfig()

  return {
    base: './',
    // ⚠️ 重要：强制从项目根目录读取环境变量文件，与 watch-build.js 保持一致
    // 默认情况下，Vite 会从 vite.config.ts 所在目录读取 .env 文件
    // 但我们需要从项目根目录读取，确保环境变量一致
    // 注意：.env.local 也应该放在项目根目录，而不是 frontend/ 目录
    envDir: PROJECT_ROOT,
    plugins: createPlugins(),
    resolve: {
      alias: {
        '@': SRC_DIR
      }
    },

    build: createBuildConfig(),

    // 依赖预构建优化：多入口页面需要显式声明
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
        // ✨ Material Web Components
        // 注意：依赖组件（ripple, focus-ring, elevation）通过动态导入加载
        // 不需要在这里显式包含，因为动态导入会绕过 tree-shaking
        '@material/web'
      ],
      exclude: [
        // 排除大型库，按需加载
        '@huggingface/transformers',
        'qrcode'
      ],
      // 强制预构建（避免首次加载慢）
      force: false,
      // 🚀 Vite 8 优化：启用持久化缓存
      // 缓存目录：node_modules/.vite
      // 缓存策略：基于 package-lock.json 和依赖版本
      holdUntilCrawlEnd: true // 等待所有静态导入爬取完成，避免全页刷新
    },

    // 通过 define 精简 Vue 产物（移除 Options API 与 Prod Devtools）
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false
    },

    // Worker 配置：使用 ES 模块格式
    worker: {
      format: 'es' as const
    },

    // 开发服务器优化
    server: createServerConfig()
  }
})
