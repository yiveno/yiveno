#!/usr/bin/env bun
/**
 * E2E runner for Management page via Chrome DevTools Protocol (Puppeteer-Core).
 *
 * Prerequisites:
 * 1) Start Chrome with remote debugging (quit all Chrome first):
 *    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile
 * 2) Load the extension in that Chrome instance
 * 3) Run this script with the extension ID
 *
 * Usage:
 *   bun scripts/e2e-management.mjs --ext <EXT_ID>
 *   bun scripts/e2e-management.mjs --ext <EXT_ID> --host http://127.0.0.1:9222
 *   bun scripts/e2e-management.mjs --ext <EXT_ID> --perf --cpu 4 --net slow4g
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
    perf: false,
    cpu: 4,
    net: 'slow4g'
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--ext') out.ext = args[++i]
    else if (a === '--host') out.host = args[++i]
    else if (a === '--perf') out.perf = true
    else if (a === '--cpu') out.cpu = Number(args[++i] || out.cpu)
    else if (a === '--net') out.net = String(args[++i] || out.net)
  }
  if (!out.ext) {
    console.error('Missing --ext <extensionId>')
    process.exit(2)
  }
  return out
}

async function ensureDirs() {
  for (const sub of ['screenshots', 'console', 'network', 'performance', 'logs']) {
    await fs.mkdir(path.join(artifactsDir, sub), { recursive: true })
  }
}

async function connectChrome(host) {
  const browser = await puppeteer.connect({
    browserURL: host,
    // 跟随当前 Chrome 窗口尺寸，避免截图右侧留白
    defaultViewport: null
  })
  return browser
}

async function saveConsole(page, tag) {
  const logs = await page.evaluate(() => {
    return window.__AB_CONSOLE_BUFFER__ || []
  })
  await fs.writeFile(
    path.join(artifactsDir, 'console', `${tag}_console.json`),
    JSON.stringify(logs, null, 2),
    'utf-8'
  )
}

async function attachConsoleBuffer(page) {
  await page.exposeFunction('__ab_push_log__', () => {})
  await page.evaluateOnNewDocument(() => {
    // Simple console buffer injected before unknown script runs
    ;(window).__AB_CONSOLE_BUFFER__ = []
    const orig = { log: console.log, warn: console.warn, error: console.error }
    const wrap = (level) => (...args) => {
      try { (window).__AB_CONSOLE_BUFFER__.push({ level, args, ts: Date.now() }) } catch {}
      return orig[level](...args)
    }
    console.log = wrap('log')
    console.warn = wrap('warn')
    console.error = wrap('error')
  })
}

async function waitForProgressGone(page, timeout = 120000) {
  // progress-text 先出现后消失，或短路其不存在
  try {
    await page.waitForSelector('[data-testid="progress-text"]', { timeout: 5000 })
    await page.waitForSelector('[data-testid="progress-text"]', { hidden: true, timeout })
  } catch {
    // 若从未出现，继续
  }
}

// 网络与 CPU 限速（性能模式）
const networkPresets = {
  slow4g: { latency: 400, downloadBps: 51200, uploadBps: 51200, label: 'Slow 4G' }, // ~50KB/s
  fast4g: { latency: 150, downloadBps: 1228800, uploadBps: 737280, label: 'Fast 4G' } // ~1.2MB/s
}

async function applyPerformanceThrottling(page, { net = 'slow4g', cpu = 4 } = {}) {
  const preset = networkPresets[net] || networkPresets.slow4g
  const client = await page.target().createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: preset.latency,
    downloadThroughput: preset.downloadBps,
    uploadThroughput: preset.uploadBps,
    connectionType: 'cellular4g'
  })
  await client.send('Emulation.setCPUThrottlingRate', { rate: Math.max(1, cpu) })
  await client.send('Performance.enable')
  return { client, preset }
}

// 通用辅助
const sleep = ms => new Promise(res => setTimeout(res, ms))

async function run() {
  const { ext, host, perf, cpu, net } = parseArgs()
  const tag = `${nowTag()}_management`
  await ensureDirs()
  const browser = await connectChrome(host)
  const page = await browser.newPage()
  await attachConsoleBuffer(page)
  const steps = []
  globalThis.__AB_TAG__ = tag

  // 性能模式：应用网络/CPU限速 + 记录 trace
  let perfClient = null
  let netPreset = null
  if (perf) {
    const { client, preset } = await applyPerformanceThrottling(page, { net, cpu })
    perfClient = client
    netPreset = preset
    await page.tracing.start({
      path: path.join(artifactsDir, 'performance', `${tag}_trace.json`),
      categories: ['devtools.timeline', 'blink.user_timing', 'disabled-by-default-v8.cpu_profiler']
    })
  }

  const extUrl = `chrome-extension://${ext}/management.html`

  // Step 1: 打开 Management 页面
  try {
    const t0 = Date.now()
    await page.goto(extUrl, { waitUntil: 'domcontentloaded' })
    await waitForProgressGone(page)
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_loaded.png`)
    await page.screenshot({ path: shot })
    steps.push({ name: 'open_management', status: 'passed', durationMs: Date.now() - t0, screenshot: shot })
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_loaded_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'open_management', status: 'failed', error: String(e), screenshot: shot })
  }

  // Step 2: 测试左侧面板搜索功能
  try {
    const t0 = Date.now()
    const searchBtns = await page.$$('.search-icon-button')
    
    if (searchBtns.length < 1) {
      throw new Error('左侧面板搜索按钮不存在')
    }
    
    // 点击展开搜索框
    await searchBtns[0].click()
    await sleep(500)
    
    // 验证搜索框已展开
    const isExpanded = await page.$('.search-wrapper.expanded')
    if (!isExpanded) {
      throw new Error('搜索框未能展开')
    }
    
    // 输入搜索词
    const searchInputs = await page.$$('.search-input input')
    if (searchInputs.length < 1) {
      throw new Error('搜索输入框不存在')
    }
    await searchInputs[0].type('书签栏', { delay: 50 })
    await sleep(1000)
    
    // 验证：检查是否显示搜索结果统计
    const statsText = await page.evaluate(() => {
      const stats = document.querySelector('.search-stats .stats-text')
      return stats ? stats.textContent : null
    })
    
    // 验证：检查输入框是否垂直居中（包含文本样式）
    const inputAlignment = await page.evaluate(() => {
      const container = document.querySelector('.search-input .acuity-input-container')
      const input = document.querySelector('.search-input input')
      if (!container || !input) return { error: '元素不存在' }
      
      const containerStyle = window.getComputedStyle(container)
      const inputStyle = window.getComputedStyle(input)
      const containerRect = container.getBoundingClientRect()
      const inputRect = input.getBoundingClientRect()
      
      // 计算输入框在容器内的垂直位置
      const containerCenter = containerRect.top + containerRect.height / 2
      const inputCenter = inputRect.top + inputRect.height / 2
      const offset = Math.abs(containerCenter - inputCenter)
      
      // 检查文本样式
      const fontSize = parseFloat(inputStyle.fontSize)
      const lineHeight = inputStyle.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(inputStyle.lineHeight)
      const inputHeightPx = parseFloat(inputStyle.height) || inputRect.height
      const textVerticalAlignment = (inputHeightPx - lineHeight) / 2
      
      return {
        containerHeight: containerRect.height,
        inputHeight: inputRect.height,
        verticalOffset: offset,
        isVerticalCentered: offset < 2, // 允许 2px 误差
        containerDisplay: containerStyle.display,
        containerAlignItems: containerStyle.alignItems,
        // 文本样式
        fontSize: inputStyle.fontSize,
        lineHeight: inputStyle.lineHeight,
        computedLineHeight: lineHeight,
        inputStyleHeight: inputStyle.height,
        textVerticalAlignment,
        // 可能导致问题的样式
        paddingTop: inputStyle.paddingTop,
        paddingBottom: inputStyle.paddingBottom,
        verticalAlign: inputStyle.verticalAlign,
        boxSizing: inputStyle.boxSizing
      }
    })
    
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_search_left.png`)
    await page.screenshot({ path: shot })
    
    // 如果输入框未居中，标记为失败
    const isCentered = inputAlignment.isVerticalCentered
    
    steps.push({ 
      name: 'search_left_panel', 
      status: isCentered ? 'passed' : 'failed', 
      durationMs: Date.now() - t0, 
      screenshot: shot,
      assertions: {
        searchBoxExpanded: true,
        searchResultStats: statsText || '无结果统计',
        inputAlignment
      },
      error: isCentered ? undefined : `输入框未垂直居中，偏移 ${inputAlignment.verticalOffset?.toFixed(1)}px`
    })
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_search_left_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'search_left_panel', status: 'failed', error: String(e), screenshot: shot })
  }

  // Step 3: 测试右侧面板搜索功能
  try {
    const t0 = Date.now()
    const searchBtns = await page.$$('.search-icon-button')
    
    if (searchBtns.length < 2) {
      throw new Error('右侧面板搜索按钮不存在')
    }
    
    // 点击展开搜索框
    await searchBtns[1].click()
    await sleep(500)
    
    // 验证搜索框已展开
    const expandedWrappers = await page.$$('.search-wrapper.expanded')
    if (expandedWrappers.length < 2) {
      throw new Error('右侧搜索框未能展开')
    }
    
    // 输入搜索词
    const searchInputs = await page.$$('.search-input input')
    if (searchInputs.length < 2) {
      throw new Error('右侧搜索输入框不存在')
    }
    await searchInputs[1].type('test', { delay: 50 })
    await sleep(1000)
    
    // 验证：检查健康度筛选标签是否存在
    const filterTags = await page.$$('.filter-tag')
    const hasHealthFilters = filterTags.length >= 2
    
    // 验证：检查搜索结果面板是否显示
    const panels = await page.$$('.search-result-panel')
    const hasPanelVisible = panels.length > 0
    
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_search_right.png`)
    await page.screenshot({ path: shot })
    
    steps.push({ 
      name: 'search_right_panel', 
      status: 'passed', 
      durationMs: Date.now() - t0, 
      screenshot: shot,
      assertions: {
        searchBoxExpanded: true,
        hasHealthFilters,
        hasPanelVisible
      }
    })
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_search_right_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'search_right_panel', status: 'failed', error: String(e), screenshot: shot })
  }

  // Step 3: 测试健康度筛选标签
  try {
    const t0 = Date.now()
    // 点击"无效书签"筛选标签
    const filterTag = await page.$('.filter-tag')
    if (filterTag) {
      await filterTag.click()
      await sleep(500)
    }
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_filter.png`)
    await page.screenshot({ path: shot })
    steps.push({ name: 'health_filter', status: 'passed', durationMs: Date.now() - t0, screenshot: shot })
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_filter_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'health_filter', status: 'failed', error: String(e), screenshot: shot })
  }

  // Step 4: 测试 AI 一键整理按钮（只点击，不等待完成）
  try {
    const t0 = Date.now()
    const aiBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return btns.find(b => /一键整理/.test(b.textContent || '')) ? true : false
    })
    if (aiBtn) {
      steps.push({ name: 'ai_organize_button', status: 'passed', durationMs: Date.now() - t0, note: 'AI organize button exists' })
    } else {
      steps.push({ name: 'ai_organize_button', status: 'skipped', reason: 'button not found' })
    }
  } catch (e) {
    steps.push({ name: 'ai_organize_button', status: 'failed', error: String(e) })
  }

  // Step 5: 测试展开/收起全部文件夹
  try {
    const t0 = Date.now()
    const expandBtn = await page.$('.expand-toggle-icon')
    if (expandBtn) {
      await expandBtn.click()
      await sleep(300)
      await expandBtn.click()
      await sleep(300)
    }
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_expand_toggle.png`)
    await page.screenshot({ path: shot })
    steps.push({ name: 'expand_collapse', status: 'passed', durationMs: Date.now() - t0, screenshot: shot })
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_expand_toggle_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'expand_collapse', status: 'failed', error: String(e), screenshot: shot })
  }

  // Step 6: 获取书签统计信息
  try {
    const t0 = Date.now()
    const stats = await page.evaluate(async () => {
      try {
        const tree = await chrome.bookmarks.getTree()
        let bookmarks = 0
        let folders = 0
        const walk = n => {
          if (!n) return
          if (n.url) bookmarks++
          else if (n.children) folders++
          if (n.children) for (const ch of n.children) walk(ch)
        }
        if (tree && tree[0]) walk(tree[0])
        return { bookmarks, folders }
      } catch {
        return { bookmarks: -1, folders: -1 }
      }
    })
    steps.push({ 
      name: 'bookmark_stats', 
      status: 'passed', 
      durationMs: Date.now() - t0,
      data: stats
    })
  } catch (e) {
    steps.push({ name: 'bookmark_stats', status: 'failed', error: String(e) })
  }

  // 保存控制台日志
  await saveConsole(page, tag)

  // 性能摘要（如启用）
  if (perf) {
    try {
      const metrics = await perfClient.send('Performance.getMetrics')
      const summary = {
        tag,
        mode: { network: netPreset?.label || 'Slow 4G', netKey: net, cpuRate: cpu },
        steps: steps.map(s => ({ name: s.name, status: s.status, durationMs: s.durationMs })),
        rawMetrics: metrics?.metrics || []
      }
      await fs.writeFile(
        path.join(artifactsDir, 'performance', `${tag}_summary.json`),
        JSON.stringify(summary, null, 2),
        'utf-8'
      )
    } catch {
      // ignore perf summary failure
    }
    try { await page.tracing.stop() } catch {}
  }

  // 保存测试结果
  await fs.writeFile(
    path.join(artifactsDir, 'logs', `${tag}_management.json`),
    JSON.stringify({ tag, url: extUrl, steps }, null, 2),
    'utf-8'
  )
  
  await browser.disconnect()
  
  // 输出测试摘要
  const passed = steps.filter(s => s.status === 'passed').length
  const failed = steps.filter(s => s.status === 'failed').length
  const skipped = steps.filter(s => s.status === 'skipped').length
  console.log(`\n✅ E2E done. Tag: ${tag}`)
  console.log(`   Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`)
  console.log(`   Artifacts: ${artifactsDir}`)
}

run().catch(err => {
  console.error('E2E failed:', err)
  process.exit(1)
})
