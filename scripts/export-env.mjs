#!/usr/bin/env bun
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const backupsDir = path.join(repoRoot, 'artifacts', 'backups')

const nowTag = () => {
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

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = { ext: '', host: 'http://localhost:9222', output: '' }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--ext') out.ext = args[++i] || ''
    else if (a === '--host') out.host = args[++i] || out.host
    else if (a === '--output') out.output = args[++i] || ''
  }
  if (!out.ext) {
    console.error('Missing --ext <extensionId>')
    process.exit(2)
  }
  return out
}

const waitForBridge = async page => {
  await page.waitForFunction(
    () =>
      typeof window !== 'undefined' &&
      typeof window.__AB_EXPORT_ENV__ === 'function' &&
      typeof window.__AB_IMPORT_ENV__ === 'function',
    { timeout: 20000 }
  )
}

const ensureDirs = async () => {
  await fs.mkdir(backupsDir, { recursive: true })
}

async function main() {
  const { ext, host, output } = parseArgs()
  await ensureDirs()
  const filePath =
    output && output.length > 0
      ? path.resolve(process.cwd(), output)
      : path.join(backupsDir, `${nowTag()}_${ext}_env.json`)

  const browser = await puppeteer.connect({
    browserURL: host,
    defaultViewport: null
  })
  const page = await browser.newPage()
  const url = `chrome-extension://${ext}/management.html?abDevtools=1`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await waitForBridge(page)

  const snapshot = await page.evaluate(async () => {
    if (typeof window.__AB_EXPORT_ENV__ !== 'function') {
      throw new Error('Env snapshot bridge missing')
    }
    return await window.__AB_EXPORT_ENV__()
  })

  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
  console.log('✅ Environment snapshot exported to', filePath)
  await browser.disconnect()
}

main().catch(err => {
  console.error('Environment export failed:', err)
  process.exit(1)
})
