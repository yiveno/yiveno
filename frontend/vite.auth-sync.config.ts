/**
 * auth-sync content script 独立构建配置（单文件 IIFE）
 */

import { defineConfig } from 'vite'
import { resolve } from 'path'

const ROOT_DIR = resolve(__dirname)
const PROJECT_ROOT = resolve(ROOT_DIR, '..')

export default defineConfig({
  envDir: resolve(PROJECT_ROOT, '.env.runtime'),
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  resolve: {
    alias: {
      '@': resolve(ROOT_DIR, 'src')
    }
  },
  build: {
    outDir: resolve(PROJECT_ROOT, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(ROOT_DIR, 'src/content/auth-sync.ts'),
      name: 'OtterSageAuthSync',
      formats: ['iife'],
      fileName: () => 'auth-sync.bundle.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production'
  }
})
