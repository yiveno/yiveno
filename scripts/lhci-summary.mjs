#!/usr/bin/env bun
// Generate an intuitive Markdown summary from LHCI results with thresholds and emojis
// Reads latest JSON result files from .lighthouseci and prints markdown to stdout
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, '.lighthouseci')

// Thresholds aligned with lighthouserc.json (assertMatrix)
const THRESHOLDS = {
  default: { performance: 0.8, accessibility: 0.9, bestPractices: 0.9, seo: 0.9 },
  popup: { performance: 0.9, accessibility: 0.9, bestPractices: 0.9, seo: 0.9 }
}

function findJsonReports(dir) {
  try {
    const all = readdirSync(dir).filter((f) => f.endsWith('.json'))
    // Ignore manifest/links etc; we will validate by inspecting content later
    return all
      .filter((f) => !/^manifest\.json$/.test(f))
      .map((f) => join(dir, f))
  } catch {
    return []
  }
}

function pickScores(lhr) {
  const cat = lhr.categories
  const s = (x) => (x && typeof x.score === 'number' ? Math.round(x.score * 100) : '—')
  return {
    performance: s(cat.performance),
    accessibility: s(cat.accessibility),
    bestPractices: s(cat['best-practices'] || cat.bestPractices),
    seo: s(cat.seo)
  }
}

function isPopup(url) {
  try {
    const u = new URL(url)
    return u.pathname.endsWith('/popup.html') || u.pathname === '/popup.html'
  } catch {
    return /popup\.html$/.test(url)
  }
}

function statusEmoji(score, threshold) {
  if (typeof score !== 'number') return '❓'
  return score >= Math.round(threshold * 100) ? '✅' : '❌'
}

function avg(nums) {
  const arr = nums.filter((n) => typeof n === 'number')
  if (!arr.length) return '—'
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

const files = findJsonReports(OUT_DIR)

const rows = []
for (const file of files) {
  try {
    const json = JSON.parse(readFileSync(file, 'utf-8'))
    if (!json || !json.categories) continue // skip non-LHR files
    const url = json.requestedUrl || json.finalUrl || '—'
    const { performance, accessibility, bestPractices, seo } = pickScores(json)
    rows.push({ url, performance, accessibility, bestPractices, seo, popup: isPopup(url) })
  } catch {}
}

if (rows.length === 0) {
  console.log('No Lighthouse JSON reports found in .lighthouseci. Run "bun run audit:lhci" or "bun run audit:lhci:collect" first.')
  process.exit(0)
}

rows.sort((a, b) => a.url.localeCompare(b.url))

const marker = '<!-- LHCI-SUMMARY -->'

// Averages
const avgPerf = avg(rows.map((r) => (typeof r.performance === 'number' ? r.performance : undefined)))
const avgA11y = avg(rows.map((r) => (typeof r.accessibility === 'number' ? r.accessibility : undefined)))
const avgBP = avg(rows.map((r) => (typeof r.bestPractices === 'number' ? r.bestPractices : undefined)))
const avgSEO = avg(rows.map((r) => (typeof r.seo === 'number' ? r.seo : undefined)))

let md = `${marker}\n\n### Lighthouse 评分摘要\n\n`
md += `总体均值：性能 ${avgPerf} · 可访问性 ${avgA11y} · 最佳实践 ${avgBP} · SEO ${avgSEO}\n\n`
md += '> 注：popup.html 的性能阈值更严格（≥90），其他页面为 ≥80；可访问性/最佳实践/SEO 阈值均为 ≥90。\n\n'

md += '| 页面 | 性能 | 可访问性 | 最佳实践 | SEO | 说明 |\n'
md += '|---|---:|---:|---:|---:|---|\n'

for (const r of rows) {
  const t = r.popup ? THRESHOLDS.popup : THRESHOLDS.default
  const perfS = `${r.performance} ${statusEmoji(r.performance, t.performance)}`
  const a11yS = `${r.accessibility} ${statusEmoji(r.accessibility, t.accessibility)}`
  const bpS = `${r.bestPractices} ${statusEmoji(r.bestPractices, t.bestPractices)}`
  const seoS = `${r.seo} ${statusEmoji(r.seo, t.seo)}`
  const note = r.popup ? '严格性能阈值（≥90）' : ''
  md += `| ${r.url} | ${perfS} | ${a11yS} | ${bpS} | ${seoS} | ${note} |\n`
}

md += '\n报告：构建 artifacts 中含 HTML/JSON；另已上传至临时公共存储（由 LHCI 提供）。\n'

console.log(md)
