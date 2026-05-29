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

    // 排除视觉测试和 E2E 测试（由 Playwright 和专门的配置运行）
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/visual/**',
      '**/*.spec.ts',
      '**/service-worker/basic-e2e.test.ts', // E2E 测试单独运行
      '**/service-worker/termination*.test.ts' // E2E 测试单独运行
    ],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/background/', // Background Script 需要特殊测试
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/types/'
      ],
      // 目标覆盖率
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    },

    // 设置文件（全局 mock）
    setupFiles: ['./src/tests/setup.ts'],

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
