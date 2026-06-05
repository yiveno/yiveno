/**
 * 构建后验证：auth-sync content script 必须为 IIFE（禁止 ES module）
 */

const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '../../dist')
const bundlePath = path.join(distDir, 'auth-sync.bundle.js')
const legacyPath = path.join(distDir, 'auth-sync.js')

if (fs.existsSync(legacyPath)) {
  console.error('❌ 检测到旧版 auth-sync.js（ES module），content script 会报 import 语法错误')
  process.exit(1)
}

if (!fs.existsSync(bundlePath)) {
  console.error('❌ auth-sync.bundle.js 不存在，请检查 IIFE 独立构建')
  process.exit(1)
}

const head = fs.readFileSync(bundlePath, 'utf8').trimStart().slice(0, 32)
if (!head.startsWith('(function')) {
  console.error('❌ auth-sync.bundle.js 不是 IIFE 格式，开头为:', head)
  process.exit(1)
}

console.log('✅ auth-sync.bundle.js 验证通过：IIFE 格式，可供 content script 注入')
