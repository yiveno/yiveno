import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 使用 happy-dom 模拟浏览器环境（比 jsdom 快）
    environment: 'happy-dom',

    // 全局 API（describe, it, expect 等）
    globals: true,

    // 无测试文件时失败，避免空跑被当成通过
    passWithNoTests: false,

    // 本配置只跑 src 旁挂单测；不含浏览器 E2E
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
