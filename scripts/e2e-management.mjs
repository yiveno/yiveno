#!/usr/bin/env bun
/**
 * v4 E2E 冒烟：通过 CDP 打开扩展 popup / settings。
 *
 * 前置：
 * 1) Chrome 开启远程调试并加载本仓库 `dist/`
 * 2) 传入扩展 ID
 *
 * Usage:
 *   bun scripts/e2e-management.mjs --ext <EXT_ID>
 *   bun scripts/e2e-management.mjs --ext <EXT_ID> --host http://127.0.0.1:9222
 *   bun scripts/e2e-management.mjs --ext <EXT_ID> --perf
 *
 * 注：`--perf` 仅记录打开耗时；v3 management 页用例已随 baseline 移除。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const artifactsDir = path.join(repoRoot, 'artifacts')

function nowTag() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    ext: '',
    host: 'http://localhost:9222',
    perf: false
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--ext') out.ext = args[++i] || ''
    else if (a === '--host') out.host = args[++i] || out.host
    else if (a === '--perf') out.perf = true
    else if (a === '--cpu' || a === '--net') i++ // 兼容旧 CLI，v4 冒烟忽略
  }
  if (!out.ext) {
    console.error('Missing --ext <extensionId>')
    process.exit(2)
  }
  return out
}

async function ensureDirs() {
  await fs.mkdir(path.join(artifactsDir, 'screenshots'), { recursive: true })
  await fs.mkdir(path.join(artifactsDir, 'logs'), { recursive: true })
}

async function openPage(browser, pageUrl, label, tag) {
  const page = await browser.newPage()
  const t0 = Date.now()
  try {
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    const title = await page.title()
    const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '')
    if (!bodyText) {
      throw new Error(`${label} 页面正文为空`)
    }
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_${label}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    return {
      name: `open_${label}`,
      status: 'passed',
      durationMs: Date.now() - t0,
      title,
      screenshot: shot
    }
  } catch (error) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_${label}_error.png`)
    try {
      await page.screenshot({ path: shot })
    } catch {
      // ignore
    }
    return {
      name: `open_${label}`,
      status: 'failed',
      durationMs: Date.now() - t0,
      error: String(error),
      screenshot: shot
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function run() {
  const { ext, host, perf } = parseArgs()
  const tag = `${nowTag()}_v4_smoke`
  await ensureDirs()

  const browser = await puppeteer.connect({
    browserURL: host,
    defaultViewport: null
  })

  const steps = []
  steps.push(
    await openPage(browser, `chrome-extension://${ext}/popup.html`, 'popup', tag)
  )
  steps.push(
    await openPage(browser, `chrome-extension://${ext}/settings.html`, 'settings', tag)
  )

  const failed = steps.filter(s => s.status === 'failed')
  const summary = {
    tag,
    ext,
    host,
    perf,
    passed: steps.length - failed.length,
    failed: failed.length,
    steps
  }

  const logPath = path.join(artifactsDir, 'logs', `${tag}.json`)
  await fs.writeFile(logPath, JSON.stringify(summary, null, 2), 'utf-8')

  console.log(`v4 E2E smoke: ${summary.passed} passed, ${summary.failed} failed`)
  console.log(`log: ${logPath}`)
  for (const step of steps) {
    const mark = step.status === 'passed' ? '✅' : '❌'
    console.log(`${mark} ${step.name} (${step.durationMs}ms)`)
  }

  await browser.disconnect()
  if (failed.length > 0) process.exit(1)
}

run().catch(err => {
  console.error('E2E smoke failed:', err)
  process.exit(1)
})
