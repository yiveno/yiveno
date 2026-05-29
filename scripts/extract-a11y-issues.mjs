#!/usr/bin/env bun
/**
 * 提取 Lighthouse 可访问性问题
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const lhciDir = join(process.cwd(), 'website', '.lighthouseci')

// 读取最新的 JSON 报告
const jsonFiles = readdirSync(lhciDir)
  .filter(f => f.startsWith('lhr-') && f.endsWith('.json'))
  .sort()
  .reverse()
  .slice(0, 21) // 最新的 21 个报告

// 按 URL 分组找中位数
const reportsByUrl = new Map()

for (const file of jsonFiles) {
  const json = JSON.parse(readFileSync(join(lhciDir, file), 'utf-8'))
  const url = json.finalUrl
  const a11yScore = json.categories?.accessibility?.score || 0
  
  if (!reportsByUrl.has(url)) {
    reportsByUrl.set(url, [])
  }
  
  reportsByUrl.get(url).push({ file, json, a11yScore })
}

// 找到每个 URL 的中位数报告
console.log('\n## 可访问性问题汇总\n')

for (const [url, reports] of reportsByUrl) {
  reports.sort((a, b) => a.a11yScore - b.a11yScore)
  const median = reports[Math.floor(reports.length / 2)]
  const { json } = median
  
  const pageName = new URL(url).pathname || '/'
  const score = Math.round(json.categories.accessibility.score * 100)
  
  console.log(`### ${pageName} (分数: ${score})`)
  console.log()
  
  // 提取失败的可访问性审计
  const audits = json.audits
  const failedAudits = []
  
  for (const [id, audit] of Object.entries(audits)) {
    // 只关注可访问性相关的审计
    if (audit.score !== null && audit.score < 1) {
      // 检查是否是可访问性审计
      const isA11y = json.categories.accessibility.auditRefs.some(ref => ref.id === id)
      if (isA11y) {
        failedAudits.push({
          id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          details: audit.details
        })
      }
    }
  }
  
  if (failedAudits.length === 0) {
    console.log('✅ 无可访问性问题\n')
  } else {
    for (const audit of failedAudits) {
      console.log(`- **${audit.title}** (${audit.id})`)
      console.log(`  - 分数: ${audit.score}`)
      
      // 显示具体的问题元素
      if (audit.details?.items) {
        const items = audit.details.items.slice(0, 3) // 只显示前 3 个
        for (const item of items) {
          if (item.node?.snippet) {
            console.log(`  - \`${item.node.snippet}\``)
          }
        }
        if (audit.details.items.length > 3) {
          console.log(`  - ... 还有 ${audit.details.items.length - 3} 个`)
        }
      }
      console.log()
    }
  }
  
  console.log('---\n')
}
