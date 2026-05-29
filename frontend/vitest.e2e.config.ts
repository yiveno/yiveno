import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // E2E 测试不需要浏览器环境模拟
    environment: 'node',

    // 全局 API
    globals: true,

    // 只包含 E2E 测试（使用基础版）
    include: ['**/service-worker/basic-e2e.test.ts'],

    // 设置文件
    setupFiles: ['./src/tests/setup.ts'],

    // 测试超时（E2E 测试需要更长时间）
    testTimeout: 120000, // 增加到 120 秒

    // Hook 超时（启动浏览器需要时间，首次运行可能需要下载 Chromium）
    hookTimeout: 180000, // 增加到 180 秒（3 分钟）

    // 单线程运行（Puppeteer 测试）
    threads: false,

    // 禁用隔离（提高性能）
    isolate: false
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
