/**
 * 验证 background.js 不包含 DOM API
 * 
 * Service Worker 环境中不存在 DOM API（HTMLElement、document、window 等）
 * 如果 background.js 导入了包含这些 API 的模块，会导致 Service Worker 无法启动
 */

const fs = require('fs')
const path = require('path')

// DOM API 关键字列表
const DOM_API_KEYWORDS = [
  'HTMLElement',
  'HTMLDivElement',
  'HTMLSpanElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'HTMLAnchorElement',
  'HTMLImageElement',
  'HTMLCanvasElement',
  'HTMLVideoElement',
  'HTMLAudioElement',
  'HTMLIFrameElement',
  'HTMLScriptElement',
  'HTMLStyleElement',
  'HTMLLinkElement',
  'HTMLMetaElement',
  'HTMLHeadElement',
  'HTMLBodyElement',
  'HTMLTableElement',
  'HTMLSelectElement',
  'HTMLOptionElement',
  'HTMLTextAreaElement',
  'HTMLLabelElement',
  'HTMLFieldSetElement',
  'HTMLLegendElement',
  'HTMLUListElement',
  'HTMLOListElement',
  'HTMLLIElement',
  'HTMLDListElement',
  'HTMLQuoteElement',
  'HTMLPreElement',
  'HTMLBRElement',
  'HTMLHRElement',
  'HTMLModElement',
  'HTMLParamElement',
  'HTMLMapElement',
  'HTMLAreaElement',
  'HTMLPictureElement',
  'HTMLSourceElement',
  'HTMLTrackElement',
  'HTMLEmbedElement',
  'HTMLObjectElement',
  'HTMLDataElement',
  'HTMLTimeElement',
  'HTMLTemplateElement',
  'HTMLSlotElement',
  'HTMLDetailsElement',
  'HTMLDialogElement',
  'HTMLMenuElement',
  'HTMLProgressElement',
  'HTMLMeterElement',
  'HTMLOutputElement',
  'HTMLDataListElement',
  'HTMLOptGroupElement',
  'HTMLUnknownElement',
  'Element',
  'Node',
  'Document',
  'Window',
  'document',
  'window',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'indexedDB', // 注意：这个在 Service Worker 中是可用的，但为了安全起见也检查
  'XMLHttpRequest',
  'FormData',
  'Blob',
  'File',
  'FileReader',
  'FileList',
  'DOMParser',
  'XMLSerializer',
  'MutationObserver',
  'IntersectionObserver',
  'ResizeObserver',
  'PerformanceObserver',
  'CustomEvent',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'TouchEvent',
  'PointerEvent',
  'WheelEvent',
  'DragEvent',
  'ClipboardEvent',
  'FocusEvent',
  'InputEvent',
  'CompositionEvent',
  'UIEvent',
  'AnimationEvent',
  'TransitionEvent',
  'MessageEvent',
  'StorageEvent',
  'PopStateEvent',
  'HashChangeEvent',
  'PageTransitionEvent',
  'BeforeUnloadEvent',
  'ErrorEvent',
  'PromiseRejectionEvent'
]

// 白名单：允许的关键字（虽然名字相似，但在 Service Worker 中是安全的）
const WHITELIST = [
  'indexedDB', // Service Worker 中可用
  'Event', // Service Worker 中可用
  'MessageEvent', // Service Worker 中可用
  'ErrorEvent', // Service Worker 中可用
  'PromiseRejectionEvent' // Service Worker 中可用
]

// 过滤掉白名单中的关键字
const FILTERED_KEYWORDS = DOM_API_KEYWORDS.filter(
  keyword => !WHITELIST.includes(keyword)
)

/**
 * 检查文件是否包含 DOM API
 * 
 * 排除安全的使用场景：
 * - typeof document === 'undefined' (环境检查)
 * - typeof window === 'undefined' (环境检查)
 * - typeof navigator === 'undefined' (环境检查)
 * - navigator?.gpu (WebGPU 检查，Service Worker 中可用)
 * - navigator.ml (WebNN 检查，Service Worker 中可用)
 * - globalThis.navigator (全局对象访问)
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const found = []

  for (const keyword of FILTERED_KEYWORDS) {
    // 使用正则表达式匹配完整单词（避免误报）
    const regex = new RegExp(`\\b${keyword}\\b`, 'g')
    const matches = content.match(regex)
    
    if (!matches) continue

    // 检查是否是安全的使用场景
    let isSafe = false
    
    // 1. 检查是否在 typeof 检查中
    const typeofRegex = new RegExp(`typeof\\s+${keyword}\\s*[!=]==?\\s*['"]undefined['"]`, 'g')
    const typeofMatches = content.match(typeofRegex)
    if (typeofMatches && typeofMatches.length >= matches.length) {
      isSafe = true
    }

    // 2. 检查是否是 navigator.gpu 或 navigator.ml（Service Worker 中可用）
    if (keyword === 'navigator') {
      const navigatorGpuRegex = /navigator\??\.(gpu|ml)/g
      const navigatorGpuMatches = content.match(navigatorGpuRegex)
      const globalThisNavigatorRegex = /globalThis\.navigator/g
      const globalThisNavigatorMatches = content.match(globalThisNavigatorRegex)
      const deviceMemoryRegex = /navigator.*deviceMemory/g
      const deviceMemoryMatches = content.match(deviceMemoryRegex)
      
      const safeNavigatorUsages = (navigatorGpuMatches?.length || 0) + 
                                   (globalThisNavigatorMatches?.length || 0) +
                                   (deviceMemoryMatches?.length || 0)
      
      if (safeNavigatorUsages >= matches.length) {
        isSafe = true
      }
    }

    // 3. 检查是否在注释中（简单检查）
    const commentRegex = new RegExp(`//.*\\b${keyword}\\b`, 'g')
    const blockCommentRegex = new RegExp(`/\\*[^*]*\\b${keyword}\\b[^*]*\\*/`, 'g')
    const commentMatches = (content.match(commentRegex)?.length || 0) + 
                           (content.match(blockCommentRegex)?.length || 0)
    if (commentMatches >= matches.length) {
      isSafe = true
    }

    if (!isSafe) {
      found.push(keyword)
    }
  }

  return found
}

/**
 * 提取 background.js 导入的所有 chunk 文件
 */
function extractImportedChunks(backgroundPath) {
  const content = fs.readFileSync(backgroundPath, 'utf-8')
  
  // 匹配 import 语句中的文件路径
  // 例如：import{a as t}from"./assets/vendor.D2AgWrdI.js"
  const importRegex = /from"\.\/assets\/([^"]+\.js)"/g
  const chunks = []
  let match

  while ((match = importRegex.exec(content)) !== null) {
    chunks.push(match[1])
  }

  // 同时检查动态导入
  // 例如：await import("./assets/crawler-manager.1HFKIjBO.js")
  const dynamicImportRegex = /import\("\.\/assets\/([^"]+\.js)"\)/g
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    chunks.push(match[1])
  }

  return [...new Set(chunks)] // 去重
}

/**
 * 主函数
 */
function main() {
  const distDir = path.join(__dirname, '../dist')
  const backgroundPath = path.join(distDir, 'background.js')
  const assetsDir = path.join(distDir, 'assets')

  if (!fs.existsSync(backgroundPath)) {
    console.error('❌ background.js 不存在')
    process.exit(1)
  }

  console.log('ℹ️  开始验证 background.js...')

  // 1. 检查 background.js 本身
  const backgroundIssues = checkFile(backgroundPath)
  if (backgroundIssues.length > 0) {
    console.error('❌ background.js 包含 DOM API:')
    backgroundIssues.forEach(keyword => {
      console.error(`   - ${keyword}`)
    })
    process.exit(1)
  }

  // 2. 提取导入的 chunk 文件
  const importedChunks = extractImportedChunks(backgroundPath)
  console.log(`ℹ️  background.js 导入了 ${importedChunks.length} 个 chunks，检查它们是否包含 DOM API...`)

  // 3. 检查每个 chunk 文件
  const problematicChunks = []
  for (const chunk of importedChunks) {
    const chunkPath = path.join(assetsDir, chunk)
    if (!fs.existsSync(chunkPath)) {
      console.warn(`⚠️  chunk 文件不存在: ${chunk}`)
      continue
    }

    const issues = checkFile(chunkPath)
    if (issues.length > 0) {
      problematicChunks.push({ chunk, issues })
    }
  }

  // 4. 报告结果
  if (problematicChunks.length > 0) {
    console.error('❌ 以下 chunks 包含 DOM API:')
    problematicChunks.forEach(({ chunk, issues }) => {
      console.error(`\n   📦 ${chunk}`)
      issues.forEach(keyword => {
        console.error(`      - ${keyword}`)
      })
    })
    console.error('\n💡 解决方案:')
    console.error('   1. 检查 background 代码是否间接导入了 Vue 组件或 Material Web Components')
    console.error('   2. 确保 background 只导入纯 TypeScript 模块（不依赖 DOM）')
    console.error('   3. 检查 vite/build-options.ts 中的 manualChunks 配置')
    process.exit(1)
  }

  console.log('✅ background.js 验证通过：无 DOM API，所有导入的 chunks 都是安全的')
}

main()
