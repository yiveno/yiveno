#!/usr/bin/env bun
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = { ext: '', host: 'http://localhost:9222', file: '' }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--ext') out.ext = args[++i] || ''
    else if (a === '--host') out.host = args[++i] || out.host
    else if (a === '--file') out.file = args[++i] || ''
  }
  if (!out.ext) {
    console.error('Missing --ext <extensionId>')
    process.exit(2)
  }
  if (!out.file) {
    console.error('Missing --file <snapshot.json>')
    process.exit(2)
  }
  return out
}

const waitForBridge = async page => {
  await page.waitForFunction(
    () =>
      typeof window !== 'undefined' &&
      typeof window.__AB_IMPORT_ENV__ === 'function',
    { timeout: 20000 }
  )
}

async function main() {
  const { ext, host, file } = parseArgs()
  const absoluteFile = path.isAbsolute(file)
    ? file
    : path.join(process.cwd(), file)
  const content = await fs.readFile(absoluteFile, 'utf-8')
  const snapshot = JSON.parse(content)

  const browser = await puppeteer.connect({
    browserURL: host,
    defaultViewport: null
  })
  const page = await browser.newPage()
  const url = `chrome-extension://${ext}/management.html?abDevtools=1`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await waitForBridge(page)

  const result = await page.evaluate(async payload => {
    if (typeof window.__AB_IMPORT_ENV__ !== 'function') {
      throw new Error('Env snapshot bridge missing')
    }
    return await window.__AB_IMPORT_ENV__(payload)
  }, snapshot)

  console.log('✅ Environment snapshot imported from', absoluteFile)
  console.log(
    `   Restored ${result.restoredRecords} records across ${result.restoredStores} stores`
  )
  console.log(
    `   Storage: ${result.storageLocalKeys} local keys, ${result.storageSessionKeys} session keys`
  )
  await browser.disconnect()
}

main().catch(err => {
  console.error('Environment import failed:', err)
  process.exit(1)
})
