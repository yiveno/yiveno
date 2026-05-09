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
 * 解决方案：对于 background.js，返回 undefined 让它自包含所有依赖
 */
export function createManualChunks(id: string) {
  // Service Worker 特殊处理：background.js 和 offscreen.js 不能有依赖分割
  // 检查是否是 background.js 或 offscreen.js 的依赖
  if (id.includes('/background/') || id.includes('/offscreen/')) {
    return undefined
  }

  if (id.includes('node_modules')) {
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

  // 应用代码分割 - 按功能模块分包
  if (id.includes('/stores/')) return 'app-stores'
  if (id.includes('/application/')) return 'app-services'
  if (id.includes('/services/')) return 'app-services'
  if (id.includes('/infrastructure/')) return 'app-infrastructure'
  if (id.includes('/core/')) return 'app-core'
  if (id.includes('/domain/')) return 'app-domain'
  if (id.includes('/config/')) return 'app-config'
  if (id.includes('/types/')) return 'app-types'
  if (id.includes('/utils/')) return 'app-utils'
  if (id.includes('/components/')) return 'app-components'
  if (id.includes('/composables/')) return 'app-composables'

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
 */
export function createBuildOptions() {
  return {
    input: createBuildInput(),
    output: {
      ...createOutputFileNames(),
      manualChunks: createManualChunks
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
