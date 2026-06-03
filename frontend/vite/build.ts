/**
 * Vite 构建配置
 *
 * Vite 8 默认使用：
 * - Rolldown（替代 Rollup）
 * - Oxc Minifier（替代 esbuild/terser）
 * - Lightning CSS（替代 esbuild CSS minifier）
 */

import type { BuildOptions } from 'vite'
import { OUT_DIR, ENABLE_SOURCEMAP } from './constants'
import { createBuildOptions, type RolldownBuildOptions } from './build-options'

/**
 * 创建构建配置
 */
export function createBuildConfig(): BuildOptions {
  const isWatchMode = process.argv.includes('--watch')

  const config: BuildOptions & { rolldownOptions?: RolldownBuildOptions } = {
    outDir: OUT_DIR,
    // watch 模式下 clean-dist 会回写 dist/_locales 等目录，二次构建时
    // Vite 清空输出目录会触发 ENOTEMPTY，因此仅在 watch 中禁用该行为。
    emptyOutDir: !isWatchMode,

    // 禁用模块预加载（Service Worker 不支持 document 操作）
    modulePreload: false,

    /**
     * 🚀 Vite 8 压缩器：terser（JavaScript 实现，压缩率最高）
     *
     * 注意：Vite 8 虽然支持 Oxc Minifier，但类型定义尚未更新
     * 等待 @vitejs/plugin-vue 更新类型定义后可切换到 'oxc'
     *
     * 可选值：
     * - 'terser'：JavaScript 实现，压缩率最高，类型安全
     * - 'esbuild'：Go 实现，速度快
     * - 'oxc'：Rust 实现，速度最快（需要类型定义更新）
     */
    minify: 'terser',

    /**
     * 🎯 目标浏览器：针对欧美市场优化
     *
     * Chrome 100+：2022年3月发布，欧美市场用户自动更新普及率 >95%
     *
     * 优势：
     * - 支持所有现代 ES2022 特性（Top-level await、私有字段等）
     * - 更小的 bundle 体积（无需 polyfill）
     * - 更快的执行速度
     * - 支持现代 CSS 特性（容器查询、:has() 等）
     */
    target: ['chrome100', 'es2022'],

    /**
     * 🎨 CSS 压缩器：Lightning CSS（Rust 实现，比 esbuild 快 100 倍）
     *
     * Vite 8 默认使用 Lightning CSS，支持：
     * - 更好的语法降级
     * - 自动添加浏览器前缀
     * - CSS 模块
     * - 现代 CSS 特性转换
     */
    cssTarget: 'chrome100',
    cssCodeSplit: true, // 启用 CSS 分割，为 popup/management 等生成独立 CSS
    cssMinify: 'lightningcss', // Vite 8 默认值

    // 关闭压缩大小报告（ANALYZE 时会生成可视化报告）
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,

    // SourceMap 配置：调试模式生成 sourcemap，生产模式不生成
    sourcemap: ENABLE_SOURCEMAP,

    // 资源处理优化 - 小资源内联以减少请求；字体仍按文件输出
    assetsInlineLimit: 4096
  }

  // Vite 8: 使用 rolldownOptions（rollupOptions 已弃用）
  config.rolldownOptions = createBuildOptions()
  // 过滤 Rolldown 对 @vueuse/core 等三方包的 INVALID_ANNOTATION 告警（无害）
  ;(config.rolldownOptions as any).onLog = (_level: string, log: any) => {
    if (log.code === 'INVALID_ANNOTATION') return
  }

  return config
}
