#!/usr/bin/env bun

/**
 * 检查启用 TypeScript 严格模式的影响
 * 用于评估 Phase 2 迁移的工作量
 */

import { $ } from 'bun'
import { readFileSync, writeFileSync } from 'fs'

const TSCONFIG_BASE = 'tsconfig.base.json'
const TSCONFIG_APP = 'frontend/tsconfig.app.json'

console.log('🔍 Phase 2 影响评估：TypeScript 严格模式\n')

// 移除 JSON 注释的辅助函数
function parseJsonWithComments(text) {
  // 移除单行注释
  text = text.replace(/\/\/.*$/gm, '')
  // 移除多行注释
  text = text.replace(/\/\*[\s\S]*?\*\//g, '')
  // 移除尾随逗号
  text = text.replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(text)
}

// 备份原始配置
const backupBase = readFileSync(TSCONFIG_BASE, 'utf-8')
const backupApp = readFileSync(TSCONFIG_APP, 'utf-8')

try {
  // Step 1: 测试 noImplicitAny
  console.log('📊 Step 1: 测试 noImplicitAny 影响...')
  const configBase1 = parseJsonWithComments(backupBase)
  configBase1.compilerOptions.noImplicitAny = true
  writeFileSync(TSCONFIG_BASE, JSON.stringify(configBase1, null, 2))
  
  const result1 = await $`cd frontend && bun run typecheck 2>&1`.nothrow()
  const errors1 = (result1.stdout.toString().match(/error TS/g) || []).length
  console.log(`   ❌ noImplicitAny: ${errors1} 个错误\n`)
  
  // 恢复配置
  writeFileSync(TSCONFIG_BASE, backupBase)
  
  // Step 2: 测试 strictNullChecks
  console.log('📊 Step 2: 测试 strictNullChecks 影响...')
  const configBase2 = parseJsonWithComments(backupBase)
  configBase2.compilerOptions.strictNullChecks = true
  writeFileSync(TSCONFIG_BASE, JSON.stringify(configBase2, null, 2))
  
  const result2 = await $`cd frontend && bun run typecheck 2>&1`.nothrow()
  const errors2 = (result2.stdout.toString().match(/error TS/g) || []).length
  console.log(`   ❌ strictNullChecks: ${errors2} 个错误\n`)
  
  // 恢复配置
  writeFileSync(TSCONFIG_BASE, backupBase)
  
  // Step 3: 测试完整 strict 模式
  console.log('📊 Step 3: 测试完整 strict 模式影响...')
  const configBase3 = parseJsonWithComments(backupBase)
  configBase3.compilerOptions.strict = true
  writeFileSync(TSCONFIG_BASE, JSON.stringify(configBase3, null, 2))
  
  const result3 = await $`cd frontend && bun run typecheck 2>&1`.nothrow()
  const errors3 = (result3.stdout.toString().match(/error TS/g) || []).length
  console.log(`   ❌ strict: true: ${errors3} 个错误\n`)
  
  // 恢复配置
  writeFileSync(TSCONFIG_BASE, backupBase)
  
  // Step 4: 测试 noUncheckedIndexedAccess
  console.log('📊 Step 4: 测试 noUncheckedIndexedAccess 影响...')
  const configBase4 = parseJsonWithComments(backupBase)
  configBase4.compilerOptions.strict = true
  configBase4.compilerOptions.noUncheckedIndexedAccess = true
  writeFileSync(TSCONFIG_BASE, JSON.stringify(configBase4, null, 2))
  
  const result4 = await $`cd frontend && bun run typecheck 2>&1`.nothrow()
  const errors4 = (result4.stdout.toString().match(/error TS/g) || []).length
  console.log(`   ❌ strict + noUncheckedIndexedAccess: ${errors4} 个错误\n`)
  
  // 生成报告
  console.log('📋 影响评估报告\n')
  console.log('┌─────────────────────────────────────┬──────────┐')
  console.log('│ 配置项                              │ 错误数   │')
  console.log('├─────────────────────────────────────┼──────────┤')
  console.log(`│ noImplicitAny                       │ ${errors1.toString().padStart(8)} │`)
  console.log(`│ strictNullChecks                    │ ${errors2.toString().padStart(8)} │`)
  console.log(`│ strict: true                        │ ${errors3.toString().padStart(8)} │`)
  console.log(`│ strict + noUncheckedIndexedAccess   │ ${errors4.toString().padStart(8)} │`)
  console.log('└─────────────────────────────────────┴──────────┘\n')
  
  // 工作量估算
  const totalErrors = errors3
  const daysEstimate = Math.ceil(totalErrors / 100)
  
  console.log('⏱️  工作量估算\n')
  console.log(`   总错误数: ${totalErrors}`)
  console.log(`   预计修复速度: 100 个/天`)
  console.log(`   预计工作量: ${daysEstimate} 天\n`)
  
  // 优先级建议
  console.log('🎯 迁移策略建议\n')
  console.log('   Phase 2.1: 启用 noImplicitAny')
  console.log(`              修复 ${errors1} 个错误 (${Math.ceil(errors1 / 100)} 天)`)
  console.log('')
  console.log('   Phase 2.2: 启用 strictNullChecks')
  console.log(`              修复 ${errors2 - errors1} 个新错误 (${Math.ceil((errors2 - errors1) / 100)} 天)`)
  console.log('')
  console.log('   Phase 2.3: 启用完整 strict 模式')
  console.log(`              修复 ${errors3 - errors2} 个新错误 (${Math.ceil((errors3 - errors2) / 100)} 天)`)
  console.log('')
  console.log('   Phase 2.4: 启用 noUncheckedIndexedAccess (可选)')
  console.log(`              修复 ${errors4 - errors3} 个新错误 (${Math.ceil((errors4 - errors3) / 100)} 天)`)
  console.log('')
  
  // 保存详细报告
  const report = {
    timestamp: new Date().toISOString(),
    results: {
      noImplicitAny: errors1,
      strictNullChecks: errors2,
      strict: errors3,
      strictWithIndexCheck: errors4
    },
    estimate: {
      totalErrors: totalErrors,
      daysEstimate: daysEstimate,
      errorsPerDay: 100
    }
  }
  
  writeFileSync(
    '.kiro/phase2-impact-report.json',
    JSON.stringify(report, null, 2)
  )
  
  console.log('✅ 详细报告已保存到: .kiro/phase2-impact-report.json\n')
  
} catch (error) {
  console.error('❌ 评估失败:', error)
} finally {
  // 确保恢复原始配置
  writeFileSync(TSCONFIG_BASE, backupBase)
  writeFileSync(TSCONFIG_APP, backupApp)
  console.log('✅ 配置已恢复\n')
}
