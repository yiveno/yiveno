#!/usr/bin/env bun

/**
 * 批量修复 Vue 事件命名问题
 * 将 kebab-case 事件名转换为 camelCase
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

// 事件名映射表（kebab-case -> camelCase）
const eventNameMap = {
  'item-click': 'itemClick',
  'search-complete': 'searchComplete',
  'search-clear': 'searchClear',
  'search-start': 'searchStart',
  'search-error': 'searchError',
  'result-click': 'resultClick',
  'node-click': 'nodeClick',
  'folder-toggle': 'folderToggle',
  'folder-add': 'folderAdd',
  'node-edit': 'nodeEdit',
  'node-delete': 'nodeDelete',
  'folder-share': 'folderShare',
  'bookmark-open-new-tab': 'bookmarkOpenNewTab',
  'bookmark-copy-url': 'bookmarkCopyUrl',
  'bookmark-toggle-favorite': 'bookmarkToggleFavorite',
  'bookmark-move': 'bookmarkMove',
  'node-select': 'nodeSelect',
  'selection-change': 'selectionChange',
  'desc-counts-updated': 'descCountsUpdated',
  'expand-state-change': 'expandStateChange'
}

// 获取所有有错误的文件
console.log('🔍 查找需要修复的文件...')
const lintOutput = execSync('bun run lint 2>&1 || true', { 
  encoding: 'utf-8',
  cwd: process.cwd()
})

// 提取文件路径
const fileSet = new Set()
const lines = lintOutput.split('\n')
for (const line of lines) {
  if (line.includes('custom-event-name-casing')) {
    // 提取文件路径（格式：/path/to/file.vue）
    const match = line.match(/\/Users\/[^\s]+\.vue/)
    if (match) {
      fileSet.add(match[0])
    }
  }
}

const files = Array.from(fileSet)
console.log(`📝 找到 ${files.length} 个文件需要修复`)

let totalReplacements = 0

// 修复每个文件
for (const filePath of files) {
  console.log(`\n🔧 修复: ${filePath.replace(process.cwd(), '.')}`)
  
  let content = readFileSync(filePath, 'utf-8')
  let fileReplacements = 0
  
  // 替换事件名
  for (const [kebabCase, camelCase] of Object.entries(eventNameMap)) {
    // 匹配 emit('event-name') 或 @event-name
    const patterns = [
      // emit('event-name')
      new RegExp(`emit\\(['"]${kebabCase}['"]`, 'g'),
      // @event-name="handler"
      new RegExp(`@${kebabCase}=`, 'g'),
      // v-on:event-name="handler"
      new RegExp(`v-on:${kebabCase}=`, 'g')
    ]
    
    for (const pattern of patterns) {
      const matches = content.match(pattern)
      if (matches) {
        fileReplacements += matches.length
        
        // 执行替换
        if (pattern.source.includes('emit')) {
          content = content.replace(pattern, `emit('${camelCase}'`)
        } else if (pattern.source.includes('@')) {
          content = content.replace(pattern, `@${camelCase}=`)
        } else {
          content = content.replace(pattern, `v-on:${camelCase}=`)
        }
      }
    }
  }
  
  if (fileReplacements > 0) {
    writeFileSync(filePath, content, 'utf-8')
    console.log(`   ✅ 替换了 ${fileReplacements} 处`)
    totalReplacements += fileReplacements
  } else {
    console.log(`   ⏭️  无需修改`)
  }
}

console.log(`\n🎉 完成！总共修复了 ${totalReplacements} 处事件命名问题`)
console.log('\n📊 运行 lint 检查修复结果...')

// 运行 lint 检查
try {
  execSync('bun run lint', { 
    encoding: 'utf-8',
    cwd: process.cwd(),
    stdio: 'inherit'
  })
} catch (error) {
  console.log('\n⚠️  仍有一些 lint 错误需要手动修复')
}
