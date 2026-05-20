#!/usr/bin/env bun

/**
 * 检查启用 TypeScript 严格模式的影响 (简化版)
 * 直接修改配置文件并运行 typecheck
 */

import { $ } from 'bun'
import { readFileSync, writeFileSync, copyFileSync } from 'fs'

const TSCONFIG_BASE = 'tsconfig.base.json'
const BACKUP_FILE = 'tsconfig.base.json.backup'

console.log('🔍 Phase 2 影响评估：TypeScript 严格模式\n')

// 备份原始配置
copyFileSync(TSCONFIG_BASE, BACKUP_FILE)
console.log('✅ 已备份原始配置\n')

async function testConfig(name, modifications) {
  console.log(`📊 测试 ${name}...`)
  
  // 读取原始配置
  const original = readFileSync(BACKUP_FILE, 'utf-8')
  
  // 应用修改
  let modified = original
  for (const [key, value] of Object.entries(modifications)) {
    // 简单的字符串替换
    const regex = new RegExp(`"${key}":\\s*(true|false)`, 'g')
    modified = modified.replace(regex, `"${key}": ${value}`)
  }
  
  // 写入修改后的配置
  writeFileSync(TSCONFIG_BASE, modified)
  
  // 运行 typecheck
  const result = await $`cd frontend && bun run typecheck 2>&1`.nothrow()
  const output = result.stdout.toString()
  
  // 统计错误数
  const errorMatches = output.match(/error TS\d+:/g)
  const errorCount = errorMatches ? errorMatches.length : 0
  
  // 提取一些示例错误
  const errorLines = output.split('\n').filter(line => line.includes('error TS'))
  const sampleErrors = errorLines.slice(0, 3)
  
  console.log(`   ${errorCount > 0 ? '❌' : '✅'} ${name}: ${errorCount} 个错误`)
  if (sampleErrors.length > 0) {
    console.log('   示例错误:')
    sampleErrors.forEach(err => {
      const match = err.match(/error (TS\d+):(.*)/)
      if (match) {
        console.log(`     - ${match[1]}: ${match[2].trim().substring(0, 60)}...`)
      }
    })
  }
  console.log('')
  
  return errorCount
}

try {
  // 当前状态（baseline）
  const baseline = await testConfig('当前配置 (baseline)', {})
  
  // Step 1: noImplicitAny
  const errors1 = await testConfig('noImplicitAny', {
    noImplicitAny: true
  })
  
  // Step 2: strictNullChecks
  const errors2 = await testConfig('strictNullChecks', {
    strictNullChecks: true
  })
  
  // Step 3: strict mode
  const errors3 = await testConfig('strict: true', {
    strict: true
  })
  
  // Step 4: strict + noUncheckedIndexedAccess
  const errors4 = await testConfig('strict + noUncheckedIndexedAccess', {
    strict: true,
    noUncheckedIndexedAccess: true
  })
  
  // 生成报告
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 影响评估报告\n')
  console.log('┌─────────────────────────────────────┬──────────┬──────────┐')
  console.log('│ 配置项                              │ 错误数   │ 新增错误 │')
  console.log('├─────────────────────────────────────┼──────────┼──────────┤')
  console.log(`│ 当前配置 (baseline)                 │ ${baseline.toString().padStart(8)} │ ${'-'.padStart(8)} │`)
  console.log(`│ noImplicitAny                       │ ${errors1.toString().padStart(8)} │ ${(errors1 - baseline).toString().padStart(8)} │`)
  console.log(`│ strictNullChecks                    │ ${errors2.toString().padStart(8)} │ ${(errors2 - baseline).toString().padStart(8)} │`)
  console.log(`│ strict: true                        │ ${errors3.toString().padStart(8)} │ ${(errors3 - baseline).toString().padStart(8)} │`)
  console.log(`│ strict + noUncheckedIndexedAccess   │ ${errors4.toString().padStart(8)} │ ${(errors4 - baseline).toString().padStart(8)} │`)
  console.log('└─────────────────────────────────────┴──────────┴──────────┘\n')
  
  // 工作量估算
  const totalNewErrors = errors3 - baseline
  const daysEstimate = Math.ceil(totalNewErrors / 100)
  
  console.log('⏱️  工作量估算\n')
  console.log(`   当前错误数: ${baseline}`)
  console.log(`   新增错误数: ${totalNewErrors}`)
  console.log(`   预计修复速度: 100 个/天`)
  console.log(`   预计工作量: ${daysEstimate} 天\n`)
  
  // 迁移策略
  console.log('🎯 推荐迁移策略\n')
  
  if (totalNewErrors === 0) {
    console.log('   ✅ 太好了！可以直接启用 strict 模式，无需修复！\n')
  } else if (totalNewErrors < 50) {
    console.log('   ✅ 错误数较少，建议一次性启用 strict 模式')
    console.log(`   ⏱️  预计工作量: 半天\n`)
  } else if (totalNewErrors < 200) {
    console.log('   ⚠️  错误数中等，建议分两步迁移：')
    console.log(`   Phase 2.1: 启用 noImplicitAny (${errors1 - baseline} 个错误, ${Math.ceil((errors1 - baseline) / 100)} 天)`)
    console.log(`   Phase 2.2: 启用 strict: true (${errors3 - errors1} 个新错误, ${Math.ceil((errors3 - errors1) / 100)} 天)\n`)
  } else {
    console.log('   ⚠️  错误数较多，建议分三步迁移：')
    console.log(`   Phase 2.1: 启用 noImplicitAny (${errors1 - baseline} 个错误, ${Math.ceil((errors1 - baseline) / 100)} 天)`)
    console.log(`   Phase 2.2: 启用 strictNullChecks (${errors2 - errors1} 个新错误, ${Math.ceil((errors2 - errors1) / 100)} 天)`)
    console.log(`   Phase 2.3: 启用完整 strict 模式 (${errors3 - errors2} 个新错误, ${Math.ceil((errors3 - errors2) / 100)} 天)\n`)
  }
  
  // 保存详细报告
  const report = {
    timestamp: new Date().toISOString(),
    baseline: baseline,
    results: {
      noImplicitAny: errors1,
      strictNullChecks: errors2,
      strict: errors3,
      strictWithIndexCheck: errors4
    },
    newErrors: {
      noImplicitAny: errors1 - baseline,
      strictNullChecks: errors2 - baseline,
      strict: errors3 - baseline,
      strictWithIndexCheck: errors4 - baseline
    },
    estimate: {
      totalNewErrors: totalNewErrors,
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
  // 恢复原始配置
  copyFileSync(BACKUP_FILE, TSCONFIG_BASE)
  console.log('✅ 配置已恢复到原始状态\n')
}
