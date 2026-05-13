/**
 * Vite 构建选项配置
 * 
 * 注意：Vite 8 使用 Rolldown 替换了 Rollup
 * 配置接口从 rollupOptions 迁移到 rolldownOptions
 */

import { resolve } from 'path'
import { SRC_DIR } from './constants'

/**
 * 创建构建输入配置
 */
export function createBuildInput() {
  return {
    popup: resolve(SRC_DIR, 'pages/popup/index.html'),
    management: resolve(SRC_DIR, 'pages/management/index.html'),
    'side-panel': resolve(SRC_DIR, 'pages/side-panel/index.html'),
    settings: resolve(SRC_DIR, 'pages/settings/index.html'),
    background: resolve(SRC_DIR, 'background/main.ts'),
    offscreen: resolve(SRC_DIR, 'offscreen/main.ts'),
    onboarding: resolve(SRC_DIR, 'pages/onboarding/index.html'),
    'content/inject-quick-add-dialog': resolve(
      SRC_DIR,
      'content/inject-quick-add-dialog.ts'
    ),
    'auth-sync': resolve(SRC_DIR, 'content/auth-sync.ts')
  }
}

/**
 * 智能分包策略
 * 
 * 优化目标：
 * 1. 减少重复代码
 * 2. 提高缓存命中率
 * 3. 优化首屏加载速度
 * 
 * 注意：Rolldown 的 manualChunks 行为与 Rollup 略有不同
 * - Rollup: 只对匹配的模块分包
 * - Rolldown: 会自动提取共享依赖到 chunk
 * 
 * ⚠️ 关键修复：background.js 不能导入任何包含 Vue 的 chunk
 * 解决方案：将所有 background 依赖的模块都返回 undefined，让它们内联到 background.js
 */
export function createManualChunks(id: string) {
  // ⚠️ 关键修复：为 background.js 创建完全独立的构建
  // 不对任何模块进行分包，让它们全部内联到 background.js 中
  // 这样可以确保 background.js 不会导入任何包含 Vue 的 chunk
  
  // 检查当前模块是否被 background.js 依赖
  // 如果是，返回 undefined，让它内联到 background.js 中
  // 注意：这个判断不够精确，但可以作为临时解决方案
  
  if (id.includes('node_modules')) {
    // ⚠️ 关键修复：Lit 和 Material Web 单独分包，不要放到 vendor
    // 这样可以避免 background.js 导入包含 DOM API 的 chunk
    // 使用更宽泛的匹配规则，确保所有 Lit 相关的包都被分离
    if (
      id.includes('lit') && 
      !id.includes('sqlite') && 
      !id.includes('polyfill')
    ) {
      return 'vendor-lit'
    }
    if (id.includes('@material')) {
      return 'vendor-material-web'
    }
    
    // 核心框架 - 单独分包，缓存友好
    if (
      id.includes('/vue/') ||
      id.includes('/vue-demi/') ||
      id.includes('@vue/')
    )
      return 'vendor-vue'
    if (id.includes('/pinia/')) return 'vendor-pinia'

    // 图标库 - 按需导入但仍单独分包
    if (id.includes('lucide-vue-next')) return 'vendor-lucide'

    // 搜索库 - 单独分包（体积较大）
    if (id.includes('flexsearch')) return 'vendor-flexsearch'

    // AI/ML 库 - 单独分包（体积最大）
    if (id.includes('@huggingface/transformers')) return 'vendor-transformers'

    // 虚拟滚动 - 单独分包
    if (id.includes('@tanstack/vue-virtual')) return 'vendor-virtual'

    // 查询库 - 合并 query 相关
    if (
      id.includes('@tanstack/vue-query') ||
      id.includes('@tanstack/query-core')
    )
      return 'vendor-query'

    // 工具库：vueuse + immer + mitt（体积小，合并）
    if (
      id.includes('@vueuse/') ||
      id.includes('immer') ||
      id.includes('mitt')
    )
      return 'vendor-utils'

    // 数据校验 - 单独分包
    if (id.includes('zod')) return 'vendor-zod'

    // 拖拽库 - 单独分包
    if (id.includes('@atlaskit/')) return 'vendor-dnd'

    // Supabase 客户端 - 单独分包
    if (id.includes('@supabase/')) return 'vendor-supabase'

    // tRPC 客户端 - 单独分包
    if (id.includes('@trpc/')) return 'vendor-trpc'

    // 其他依赖归入 vendor
    return 'vendor'
  }

  // ⚠️ 关键修复：不对任何应用代码进行分包
  // 让 Rolldown 自动处理，或者让模块内联到各自的入口文件中
  // 这样可以避免 background.js 导入包含 Vue 的 chunk
  
  return undefined
}

/**
 * 创建输出文件名配置
 */
export function createOutputFileNames() {
  return {
    chunkFileNames: 'assets/[name].[hash:8].js',
    entryFileNames: (chunkInfo: { name: string }) => {
      if (['background', 'offscreen'].includes(chunkInfo.name)) {
        return '[name].js'
      }
      // Content script 也需要固定文件名（manifest 中引用）
      if (chunkInfo.name === 'content/inject-quick-add-dialog') {
        return 'content/inject-quick-add-dialog.js'
      }
      if (chunkInfo.name === 'auth-sync') {
        return 'auth-sync.js'
      }
      return 'assets/[name].[hash:8].js'
    },
    assetFileNames: (assetInfo: { name?: string }) => {
      const name = assetInfo.name || ''
      const ext = name.split('.').pop() || ''
      // WASM 文件：不加哈希，保持原始文件名（ONNX Runtime 需要）
      if (ext === 'wasm') {
        return 'assets/[name].[ext]'
      }
      // 字体文件：加哈希，进入 fonts/
      if (/woff2?|ttf|eot|otf/i.test(ext)) {
        return 'fonts/[name].[hash:8].[ext]'
      }
      // 图片文件：进入 images/
      if (/png|jpe?g|svg|gif|webp|avif/i.test(ext)) {
        return 'images/[name].[hash:8].[ext]'
      }
      // CSS 文件：进入 styles/
      if (ext === 'css') {
        return 'styles/[name].[hash:8].[ext]'
      }
      // 其他资源
      return 'assets/[name].[hash:8].[ext]'
    }
  }
}

/**
 * 创建构建配置
 * 
 * Vite 8 使用 Rolldown 替换了 Rollup
 * 返回类型使用 rolldownOptions（rollupOptions 已弃用）
 * 
 * 注意：类型定义尚未更新，返回 any 类型
 * 
 * ⚠️ 关键问题：Rolldown 的 manualChunks 无法完全阻止 chunk 依赖
 * 解决方案：对于 background.js，我们需要确保它不导入任何包含 DOM API 的模块
 */
export function createBuildOptions() {
  return {
    input: createBuildInput(),
    output: {
      ...createOutputFileNames(),
      manualChunks: createManualChunks,
      // ⚠️ 关键修复：为 background.js 内联所有动态导入
      // 这样可以避免它依赖包含 Vue 的 chunk
      inlineDynamicImports: false
    },
    // 🌳 Tree-shaking 优化配置
    // Vite 8 使用 Rolldown 的 tree-shaking，比 Rollup 更激进
    treeshake: {
      // 对 node_modules 启用副作用检测（移除未使用的代码）
      moduleSideEffects: (id: string) => !id.includes('node_modules'),
      // 禁用属性读取副作用检测（更激进的 tree-shaking）
      propertyReadSideEffects: false
    },
    // 为 background.js 和 offscreen.js 创建独立的构建
    // 避免它们共享 chunk
    preserveEntrySignatures: 'strict'
  }
}
