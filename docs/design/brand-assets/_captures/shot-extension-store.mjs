/**
 * 商店 / Figma 用：加载本仓 dist 扩展，截 1280×800 产品 UI。
 * 注意：独立 Profile，无日常库数据 → 空态/冷启动也算产品 UI（优于品牌临时图）。
 *
 * Profile 与 PNG 一律写在系统临时目录，跑完删 Profile；定稿请手动/脚本拷进 chrome-web-store/。
 *
 * 用法：bun docs/design/brand-assets/_captures/shot-extension-store.mjs
 */
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')
const extPath = path.join(repoRoot, 'dist')
const chromeBin =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS/Chromium`

if (!fs.existsSync(path.join(extPath, 'manifest.json'))) {
  console.error('missing dist/manifest.json — run: cd extension && bun run build')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yiveno-pw-ext-'))
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `yiveno-cws-shots-${stamp}-`))

/** 结束后清掉 Chromium profile（Code Cache 等 · 无保留价值） */
function cleanupProfile() {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true })
  } catch (err) {
    console.warn('profile cleanup failed', err)
  }
}

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  executablePath: fs.existsSync(chromeBin) ? chromeBin : undefined,
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
    '--no-first-run',
    '--disable-default-apps'
  ],
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1
})

let extId = null
try {
  for (let i = 0; i < 40; i++) {
    const sw =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent('serviceworker', { timeout: 2000 }).catch(() => null))
    if (sw) {
      const u = sw.url()
      const m = u.match(/chrome-extension:\/\/([a-p]{32})\//)
      if (m) {
        extId = m[1]
        break
      }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  if (!extId) {
    console.error('could not resolve extension id', {
      workers: context.serviceWorkers().map((w) => w.url())
    })
    process.exitCode = 1
  } else {
    console.log('extensionId', extId)

    async function shot(name, urlPath) {
      const page = await context.newPage()
      await page.setViewportSize({ width: 1280, height: 800 })
      const url = `chrome-extension://${extId}/${urlPath}`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(1500)
      const file = path.join(outDir, `${name}-1280x800.png`)
      await page.screenshot({ path: file, type: 'png' })
      console.log('wrote', file)
      await page.close()
      return file
    }

    const files = []
    files.push(await shot('screenshot-sidepanel-recall', 'sidepanel.html'))
    files.push(await shot('screenshot-library', 'library.html'))
    files.push(await shot('screenshot-settings', 'settings.html'))
    files.push(await shot('screenshot-getting-started', 'getting-started.html'))

    console.log(
      JSON.stringify(
        {
          extId,
          outDir,
          files,
          hint: '定稿：拷贝到 docs/design/brand-assets/chrome-web-store/ 并更新契约；本目录可删'
        },
        null,
        2
      )
    )
  }
} finally {
  await context.close().catch(() => {})
  cleanupProfile()
}
