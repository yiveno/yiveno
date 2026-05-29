#!/usr/bin/env bun
/**
 * 只打开中位数报告，避免打开太多标签页
 * 读取所有 JSON 报告，按 URL 分组，找到中位数（按性能分数）
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const type = process.argv[2] || 'website' // 'website' or 'frontend'

// 检查当前目录是否已经在 website/frontend 目录中
const cwd = process.cwd()
const isInTypeDir = cwd.endsWith(`/${type}`) || cwd.endsWith(`\\${type}`)

// 如果已经在目标目录中，直接使用 .lighthouseci，否则加上类型前缀
const lhciDir = isInTypeDir 
  ? join(cwd, '.lighthouseci')
  : join(cwd, type, '.lighthouseci')

if (!existsSync(lhciDir)) {
  console.log(`⚠️  未找到 ${lhciDir}，跳过打开报告`)
  process.exit(0)
}

try {
  // 读取所有 JSON 报告
  const jsonFiles = readdirSync(lhciDir)
    .filter(f => f.startsWith('lhr-') && f.endsWith('.json'))
    .map(f => join(lhciDir, f))
  
  if (jsonFiles.length === 0) {
    console.log('⚠️  未找到报告文件')
    process.exit(0)
  }
  
  // 按 URL 分组
  const reportsByUrl = new Map()
  
  for (const file of jsonFiles) {
    const json = JSON.parse(readFileSync(file, 'utf-8'))
    const url = json.requestedUrl || json.finalUrl
    const perfScore = json.categories?.performance?.score || 0
    const timestamp = file.match(/lhr-(\d+)\.json$/)?.[1]
    
    if (!reportsByUrl.has(url)) {
      reportsByUrl.set(url, [])
    }
    
    reportsByUrl.get(url).push({
      file,
      timestamp,
      perfScore,
      url
    })
  }
  
  // 找到每个 URL 的中位数报告（按性能分数排序，取中间值）
  const medianReports = []
  
  for (const [url, reports] of reportsByUrl) {
    // 按性能分数排序
    reports.sort((a, b) => a.perfScore - b.perfScore)
    
    // 取中位数
    const medianIndex = Math.floor(reports.length / 2)
    const median = reports[medianIndex]
    
    // 找到对应的 HTML 文件
    const htmlFile = join(lhciDir, `lhr-${median.timestamp}.html`)
    
    if (existsSync(htmlFile)) {
      medianReports.push({ url, file: htmlFile })
    }
  }
  
  if (medianReports.length === 0) {
    console.log('⚠️  未找到中位数报告')
    process.exit(0)
  }
  
  // 打开所有中位数报告
  console.log(`\n📊 打开 ${medianReports.length} 个中位数报告...\n`)
  
  for (const { url, file } of medianReports) {
    const pageName = new URL(url).pathname || '/'
    console.log(`   ${pageName}`)
    execSync(`open "${file}"`, { stdio: 'ignore' })
  }
  
  console.log('\n✅ 报告已在浏览器中打开\n')
} catch (err) {
  console.error('❌ 打开报告失败:', err.message)
  console.error(err.stack)
  process.exit(1)
}
