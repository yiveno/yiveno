import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  test: {
    // 使用 happy-dom 模拟浏览器环境（比 jsdom 快）
    environment: 'happy-dom',

    // 全局 API（describe, it, expect 等）
    globals: true,

    // 无测试文件时失败，避免空跑被当成通过
    passWithNoTests: false,

    // 本配置只跑 src 旁挂单测；扩展 UI 验收走 MCP 真机，不上 Playwright E2E
    exclude: ['**/node_modules/**', '**/dist/**'],

    // 并行测试
    pool: 'threads',

    /**
     * 保持 isolate:true（默认）：本仓大量测依赖 happy-dom IndexedDB / chrome stub，
     * isolate:false 会出现 `indexedDB is not defined` 跨文件串扰。
     * Vitest 5 的 ESM 配置已用 .mts 接 native configLoader。
     */

    // 测试超时
    testTimeout: 10000
  },

  resolve: {
    alias: {
      '@': resolve(rootDir, './src')
    }
  }
})
