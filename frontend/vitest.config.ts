import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 使用 happy-dom 模拟浏览器环境（比 jsdom 快 2-3 倍）
    environment: 'happy-dom',

    // 全局 API（describe, it, expect 等）
    globals: true,

    // v4 baseline 暂无单测文件；恢复测试后移除此项
    passWithNoTests: false,

    // 排除视觉测试和 E2E 测试（由 Playwright 和专门的配置运行）
    exclude: ['**/node_modules/**', '**/dist/**'],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '**/*.d.ts', '**/*.config.*']
    },

    // 并行测试
    threads: true,

    // 测试超时
    testTimeout: 10000
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
