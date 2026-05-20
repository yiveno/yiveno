#!/usr/bin/env node

/**
 * 清理 frontend 目录中的过时注释
 * 
 * 清理规则：
 * 1. 删除状态标记注释（已删除、已移除、已弃用等）
 * 2. 删除提示性注释（注意：XXX 已在 YYY 中配置）
 * 3. 删除迁移提示（使用 XXX 替代）
 * 4. 删除过时的 TODO、FIXME 标记
 * 5. 删除重复代码逻辑的注释
 * 
 * 保留规则：
 * - 解释"为什么"的注释
 * - 复杂算法的思路说明
 * - 外部依赖的限制或 bug workaround
 * - API 文档（JSDoc）
 */

import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import { resolve } from 'path'

// 需要清理的注释模式
const PATTERNS_TO_REMOVE = [
  // 状态标记
  /\/\/\s*✅\s*已移除.*/g,
  /\/\/\s*❌\s*已删除.*/g,
  /\/\/\s*已弃用.*/g,
  /\/\/\s*@deprecated\s*使用.*替代/g,
  
  // 提示性注释
  /\/\/\s*注意：.*已在.*中配置.*/g,
  /\/\/\s*使用.*替代.*/g,
  
  // 清理标记
  /\/\/\s*cleanup-\w+\s*已移除.*/g,
  
  // 空的或无意义的注释
  /\/\/\s*✅\s*$/g,
  /\/\/\s*❌\s*$/g,
  
  // 多行注释中的类似模式
  /\/\*\*?\s*\n\s*\*\s*@deprecated\s*使用.*替代\s*\n\s*\*\//g,
]

// 需要清理的整行注释（包括前后空行）
const LINE_PATTERNS_TO_REMOVE = [
  /^\s*\/\/\s*✅\s*已移除.*\n/gm,
  /^\s*\/\/\s*❌\s*已删除.*\n/gm,
  /^\s*\/\/\s*已弃用.*\n/gm,
  /^\s*\/\/\s*注意：.*已在.*中配置.*\n/gm,
  /^\s*\/\/\s*使用.*替代.*\n/gm,
  /^\s*\/\/\s*cleanup-\w+\s*已移除.*\n/gm,
  /^\s*\/\/\s*@deprecated\s*使用.*替代.*\n/gm,
]

function cleanFile(filePath) {
  let content = readFileSync(filePath, 'utf-8')
  const originalContent = content
  
  // 应用所有清理模式
  for (const pattern of PATTERNS_TO_REMOVE) {
    content = content.replace(pattern, '')
  }
  
  for (const pattern of LINE_PATTERNS_TO_REMOVE) {
    content = content.replace(pattern, '')
  }
  
  // 清理多余的空行（超过2个连续空行）
  content = content.replace(/\n{3,}/g, '\n\n')
  
  // 如果内容有变化，写回文件
  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf-8')
    return true
  }
  
  return false
}

async function main() {
  const frontendSrc = resolve(process.cwd(), 'frontend/src')
  
  // 查找所有 .ts, .vue, .js 文件
  const files = await glob('**/*.{ts,vue,js}', {
    cwd: frontendSrc,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  })
  
  console.log(`找到 ${files.length} 个文件需要检查...`)
  
  let cleanedCount = 0
  
  for (const file of files) {
    if (cleanFile(file)) {
      cleanedCount++
      console.log(`✓ 清理: ${file.replace(frontendSrc, 'frontend/src')}`)
    }
  }
  
  console.log(`\n完成！共清理 ${cleanedCount} 个文件`)
}

main().catch(console.error)
