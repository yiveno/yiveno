#!/usr/bin/env bun
/**
 * v4 E2E 薄冒烟（CDP + 已加载的 dist/ 扩展）：
 * 1) 打开 popup / settings
 * 2) Popup：写入一条固定摘录 → 发线索 → 断言出现结果卡
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
 * 边界：不上全量可视化回归 / 大型 Playwright 套件（见产品文档 §1.1）。
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

async function screenshot(page, tag, label) {
  const shot = path.join(artifactsDir, 'screenshots', `${tag}_${label}.png`)
  await page.screenshot({ path: shot, fullPage: true })
  return shot
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
    const shot = await screenshot(page, tag, label)
    return {
      name: `open_${label}`,
      status: 'passed',
      durationMs: Date.now() - t0,
      title,
      screenshot: shot
    }
  } catch (error) {
    let shot = ''
    try {
      shot = await screenshot(page, tag, `${label}_error`)
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

/**
 * 薄冒烟主路径：seed 摘录 → 输入唯一线索 → 发送 → 出现 .recall-card。
 */
async function smokePopupRecallCard(browser, ext, tag) {
  const page = await browser.newPage()
  const t0 = Date.now()
  const token = `yiveno-e2e-smoke-${Date.now()}`
  try {
    await page.goto(`chrome-extension://${ext}/popup.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    await page.waitForSelector('textarea.recall-input', { timeout: 10000 })

    const capture = await page.evaluate(async selectedText => {
      return await chrome.runtime.sendMessage({
        scope: 'background',
        type: 'CAPTURE_TEXT_EXCERPT',
        payload: {
          selectedText,
          sourceUrl: 'https://example.com/yiveno-e2e-smoke',
          pageTitle: 'Yiveno E2E Smoke',
          captureEntry: 'popup'
        }
      })
    }, token)

    if (!capture || capture.ok !== true) {
      throw new Error(`seed CAPTURE_TEXT_EXCERPT 失败: ${JSON.stringify(capture)}`)
    }

    await page.focus('textarea.recall-input')
    await page.evaluate(() => {
      const el = document.querySelector('textarea.recall-input')
      if (!(el instanceof HTMLTextAreaElement)) {
        return
      }
      el.value = ''
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.type('textarea.recall-input', token, { delay: 2 })

    await page.waitForFunction(() => {
      const btn = document.querySelector('.recall-send-button')
      return btn instanceof HTMLButtonElement && !btn.disabled
    }, { timeout: 5000 })

    await page.click('.recall-send-button')
    await page.waitForSelector('.recall-card', { timeout: 15000 })

    const shot = await screenshot(page, tag, 'popup_recall_card')
    return {
      name: 'popup_recall_card',
      status: 'passed',
      durationMs: Date.now() - t0,
      token,
      screenshot: shot
    }
  } catch (error) {
    let shot = ''
    try {
      shot = await screenshot(page, tag, 'popup_recall_card_error')
    } catch {
      // ignore
    }
    return {
      name: 'popup_recall_card',
      status: 'failed',
      durationMs: Date.now() - t0,
      token,
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
  steps.push(await openPage(browser, `chrome-extension://${ext}/popup.html`, 'popup', tag))
  steps.push(await openPage(browser, `chrome-extension://${ext}/settings.html`, 'settings', tag))
  steps.push(await smokePopupRecallCard(browser, ext, tag))

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
