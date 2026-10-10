/** Chrome 扩展 Vite 构建选项。 */
import type { BuildOptions } from 'vite'
import { OUT_DIR, DEBUG_MODE } from './constants'
import { createBuildOptions } from './build-options'

/** `vite build --watch`：本地迭代；一次性 `vite build`：干净产物。 */
const isWatchBuild = process.argv.includes('--watch')

/**
 * Watch 防抖（ms）：连续保存时合并为一次重建。
 * Rolldown 默认 0（几乎每改即编）；扩展整包 + content IIFE 偏重，400ms 更合适。
 */
export const WATCH_BUILD_DELAY_MS = 400

/** 创建扩展打包构建配置（sidepanel / settings / background / offscreen 占位等）。 */
export function createBuildConfig(mode: string): BuildOptions {
  const includeProbeConsole = mode !== 'production'
  return {
    outDir: OUT_DIR,
    // watch 不清空 dist，避免与收尾竞态删掉仍被 HTML 引用的 CSS
    emptyOutDir: !isWatchBuild,
    // SW 无 document：必须关 polyfill，否则动态 import 预加载会抛 window/document is not defined
    modulePreload: false,
    // watch 不 minify：重建更快、扩展调试更易读；正式 build 仍走 terser
    minify: isWatchBuild ? false : 'terser',
    target: ['chrome116', 'es2022'],
    cssTarget: 'chrome116',
    cssCodeSplit: true,
    cssMinify: isWatchBuild ? false : 'lightningcss',
    reportCompressedSize: false,
    sourcemap: DEBUG_MODE,
    assetsInlineLimit: 4096,
    rolldownOptions: createBuildOptions({ includeProbeConsole }),
    ...(isWatchBuild
      ? {
          watch: {
            buildDelay: WATCH_BUILD_DELAY_MS,
            // concurrently 多路日志时，清屏会冲掉 be/web 输出
            clearScreen: false,
            exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**']
          }
        }
      : {})
  }
}
