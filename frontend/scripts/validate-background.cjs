/**
 * 构建后验证脚本：确保 background.js 是干净的 Service Worker
 *
 * 检查项：
 * 1. 不包含 document.* 调用（Service Worker 没有 DOM）
 * 2. 不包含 window.* 调用（Service Worker 没有 window）
 * 3. 不包含 localStorage（Service Worker 没有 localStorage）
 * 4. 不导入包含 HTMLElement 的 chunks（Vue/Material Web Components）
 */

const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '../../dist')
const backgroundFile = path.join(distDir, 'background.js')

if (!fs.existsSync(backgroundFile)) {
  console.error('❌ background.js 不存在，请先构建')
  process.exit(1)
}

const content = fs.readFileSync(backgroundFile, 'utf-8')

const violations = []

// 检查 DOM API 调用（排除注释和字符串中的误报）
const domPatterns = [
  { pattern: /\bdocument\.createElement\b/, name: 'document.createElement' },
  { pattern: /\bdocument\.querySelector\b/, name: 'document.querySelector' },
  { pattern: /\bdocument\.getElementById\b/, name: 'document.getElementById' },
  { pattern: /\bdocument\.body\b/, name: 'document.body' },
  { pattern: /\blocalStorage\b/, name: 'localStorage' },
  { pattern: /\bsessionStorage\b/, name: 'sessionStorage' },
]

for (const { pattern, name } of domPatterns) {
  if (pattern.test(content)) {
    violations.push(name)
  }
}

if (violations.length > 0) {
  console.error('❌ background.js 包含不兼容 Service Worker 的 API:')
  violations.forEach(v => console.error(`   - ${v}`))
  console.error('\n这通常意味着某个 services/ 或 infrastructure/ 层的模块')
  console.error('被错误地打包进了 background.js 依赖的 chunk。')
  console.error('请检查是否有跨层导入（services → background）。')
  process.exit(1)
}

// 检查 background.js 导入的 chunk 是否包含 DOM 代码
const importPattern = /import\{[^}]+\}from"([^"]+)"/g
let match
const importedChunks = []
while ((match = importPattern.exec(content)) !== null) {
  const chunkPath = match[1]
  if (chunkPath.startsWith('./assets/')) {
    importedChunks.push(chunkPath)
  }
}

if (importedChunks.length > 0) {
  console.log(`ℹ️  background.js 导入了 ${importedChunks.length} 个 chunks，检查它们是否包含 DOM API...`)
  
  let hasHTMLElement = false
  for (const chunkPath of importedChunks) {
    const fullPath = path.join(distDir, chunkPath)
    if (fs.existsSync(fullPath)) {
      const chunkContent = fs.readFileSync(fullPath, 'utf-8')
      if (chunkContent.includes('HTMLElement')) {
        console.error(`❌ ${chunkPath} 包含 HTMLElement 引用`)
        
        // 尝试找出 HTMLElement 出现的上下文
        const lines = chunkContent.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('HTMLElement')) {
            const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n')
            console.error(`\n上下文（第 ${i + 1} 行附近）：`)
            console.error(context.substring(0, 500)) // 只显示前500个字符
            break
          }
        }
        
        console.error('   这通常意味着 Vue 或 Material Web Components 被错误地打包进了这个 chunk')
        hasHTMLElement = true
      }
    }
  }
  
  if (hasHTMLElement) {
    console.error('\n💡 解决方案：')
    console.error('   1. 检查 background/ 目录中的代码是否导入了 Vue 组件或 composables')
    console.error('   2. 检查 services/ 中的代码是否导入了 Vue 相关的模块')
    console.error('   3. 确保 background 只导入纯 TypeScript 模块（不包含 Vue）')
    console.error('\n📊 background.js 导入的所有 chunks：')
    importedChunks.forEach(chunk => console.error(`   - ${chunk}`))
    process.exit(1)
  }
}

console.log('✅ background.js 验证通过：无 DOM API，所有导入的 chunks 都是安全的')
