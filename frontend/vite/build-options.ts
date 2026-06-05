/**
 * Vite 构建选项配置
 *
 * 注意：Vite 8 使用 Rolldown 替换了 Rollup
 * 配置接口从 rollupOptions 迁移到 rolldownOptions
 */

import { resolve } from 'path'
import { SRC_DIR } from './constants'

/**
 * 当前仅使用 Vite 8 rolldownOptions 的稳定子集。
 */
export interface RolldownBuildOptions {
  input: ReturnType<typeof createBuildInput>
  output: ReturnType<typeof createOutputFileNames> & {
    manualChunks: typeof createManualChunks
  }
  treeshake: {
    moduleSideEffects: (id: string) => boolean
    propertyReadSideEffects: false
  }
  preserveEntrySignatures: 'strict'
}

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
    'save-popup': resolve(SRC_DIR, 'pages/save-popup/index.html')
    // auth-sync 由 auth-sync IIFE 独立构建（见 vite/auth-sync-build.ts）
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
 /**
 * ⚠️ 关键修复：background.js 不能导入任何包含 Vue 的 chunk
 * 解决方案：将所有 background 依赖的模块都返回 undefined，让它们内联到 background.js
 */
export function createManualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  return categorizeVendor(id)
}

/**
 * 分类 vendor 模块
 */
function categorizeVendor(id: string): string {
  return (
    checkVirtualVendor(id) ||
    checkTransformersVendor(id) ||
    checkQRCodeVendor(id) ||
    checkLitVendor(id) ||
    checkMaterialVendor(id) ||
    checkFrameworkVendor(id) ||
    checkIconVendor(id) ||
    checkSearchVendor(id) ||
    checkQueryVendor(id) ||
    checkUtilsVendor(id) ||
    checkZodVendor(id) ||
    checkDndVendor(id) ||
    checkSupabaseVendor(id) ||
    checkTrpcVendor(id) ||
    'vendor'
  )
}

/**
 * 检查虚拟滚动相关依赖
 */
function checkVirtualVendor(id: string): string | undefined {
  if (
    id.includes('@tanstack/vue-virtual') ||
    id.includes('@tanstack/virtual-core') ||
    id.includes('/raf-schd/')
  ) {
    return 'vendor-virtual'
  }
  return undefined
}

/**
 * 检查 ONNX / Transformers 运行时
 */
function checkTransformersVendor(id: string): string | undefined {
  if (
    id.includes('@huggingface/transformers') ||
    id.includes('/onnxruntime-web/') ||
    id.includes('/onnxruntime-common/')
  ) {
    return 'vendor-transformers'
  }
  return undefined
}

/**
 * 检查 QRCode 依赖
 */
function checkQRCodeVendor(id: string): string | undefined {
  if (id.includes('/qrcode/')) {
    return 'vendor-qrcode'
  }
  return undefined
}

/**
 * 检查 Lit 依赖
 */
function checkLitVendor(id: string): string | undefined {
  if (id.includes('lit') && !id.includes('sqlite') && !id.includes('polyfill')) {
    return 'vendor-lit'
  }
  return undefined
}

/**
 * 检查 Material Web 依赖
 */
function checkMaterialVendor(id: string): string | undefined {
  if (id.includes('@material')) {
    return 'vendor-material-web'
  }
  return undefined
}

/**
 * 检查核心框架依赖
 */
function checkFrameworkVendor(id: string): string | undefined {
  if (id.includes('/vue/') || id.includes('/vue-demi/') || id.includes('@vue/')) {
    return 'vendor-vue'
  }
  if (id.includes('/pinia/')) {
    return 'vendor-pinia'
  }
  return undefined
}

/**
 * 检查图标库依赖
 */
function checkIconVendor(id: string): string | undefined {
  if (id.includes('lucide-vue-next')) {
    return 'vendor-lucide'
  }
  return undefined
}

/**
 * 检查搜索库依赖
 */
function checkSearchVendor(id: string): string | undefined {
  if (id.includes('flexsearch')) {
    return 'vendor-flexsearch'
  }
  return undefined
}

/**
 * 检查查询库依赖
 */
function checkQueryVendor(id: string): string | undefined {
  if (id.includes('@tanstack/vue-query') || id.includes('@tanstack/query-core')) {
    return 'vendor-query'
  }
  return undefined
}

/**
 * 检查工具库依赖
 */
function checkUtilsVendor(id: string): string | undefined {
  if (id.includes('@vueuse/') || id.includes('immer') || id.includes('mitt')) {
    return 'vendor-utils'
  }
  return undefined
}

/**
 * 检查数据校验依赖
 */
function checkZodVendor(id: string): string | undefined {
  if (id.includes('zod')) {
    return 'vendor-zod'
  }
  return undefined
}

/**
 * 检查拖拽库依赖
 */
function checkDndVendor(id: string): string | undefined {
  if (id.includes('@atlaskit/')) {
    return 'vendor-dnd'
  }
  return undefined
}

/**
 * 检查 Supabase 客户端依赖
 */
function checkSupabaseVendor(id: string): string | undefined {
  if (id.includes('@supabase/')) {
    return 'vendor-supabase'
  }
  return undefined
}

/**
 * 检查 tRPC 客户端依赖
 */
function checkTrpcVendor(id: string): string | undefined {
  if (id.includes('@trpc/')) {
    return 'vendor-trpc'
  }
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
export function createBuildOptions(): RolldownBuildOptions {
  return {
    input: createBuildInput(),
    output: {
      ...createOutputFileNames(),
      manualChunks: createManualChunks
    },
    // 🌳 Tree-shaking 优化配置
    // Vite 8 使用 Rolldown 的 tree-shaking，比 Rollup 更激进
    treeshake: {
      /**
       * Lit / Material Web 通过模块顶层 `customElements.define` 注册组件，
       * 若对 `node_modules` 一律 `moduleSideEffects: false`，仅副作用的
       * `import '@material/web/...'` 会被摇掉，页面将出现未升级的裸标签（无 Shadow DOM）。
       */
      moduleSideEffects: (id: string) => {
        if (id.includes('node_modules/@material/web')) {
          return true
        }
        return !id.includes('node_modules')
      },
      // 禁用属性读取副作用检测（更激进的 tree-shaking）
      propertyReadSideEffects: false
    },
    // 为 background.js 和 offscreen.js 创建独立的构建
    // 避免它们共享 chunk
    preserveEntrySignatures: 'strict'
  }
}
