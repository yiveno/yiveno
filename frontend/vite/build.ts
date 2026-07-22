/** v4 基础设施构建配置。 */
import type { BuildOptions } from 'vite'
import { OUT_DIR, DEBUG_MODE } from './constants'
import { createBuildOptions } from './build-options'

/** 创建不含任何业务插件的扩展构建配置。 */
export function createBuildConfig(): BuildOptions {
  return {
    outDir: OUT_DIR,
    emptyOutDir: true,
    modulePreload: false,
    minify: 'terser',
    target: ['chrome116', 'es2022'],
    cssTarget: 'chrome116',
    cssCodeSplit: true,
    cssMinify: 'lightningcss',
    reportCompressedSize: false,
    sourcemap: DEBUG_MODE,
    assetsInlineLimit: 4096,
    rolldownOptions: createBuildOptions()
  }
}
