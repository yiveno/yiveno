import { chromium } from '/private/var/folders/3k/qgf267rd2yd5q1z5mql6j8zw0000gn/T/bunx-501-playwright@1.55.0/node_modules/playwright/index.mjs'

const outDir = new URL('./', import.meta.url).pathname

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_BROWSERS_PATH +
    '/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto('https://yiveno.com/', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)

await page.screenshot({
  path: `${outDir}yiveno-hero-1280x800.png`,
  clip: { x: 0, y: 0, width: 1280, height: 800 }
})

async function shotNear(headingText, out) {
  const h = page.getByRole('heading', { name: headingText }).first()
  await h.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const handle = await h.evaluateHandle((el) => {
    let n = el
    while (n && n !== document.body) {
      if (n.tagName === 'SECTION' || n.getAttribute('role') === 'region') return n
      n = n.parentElement
    }
    return el.parentElement
  })
  const el = handle.asElement()
  if (!el) throw new Error(`no section for ${headingText}`)
  await el.screenshot({ path: `${outDir}${out}` })
  console.log('wrote', out)
}

await shotNear('Save anything worth remembering.', 'yiveno-capture-section.png')
await shotNear("Remember the idea. That's enough.", 'yiveno-recall-section.png')
await shotNear("You don't have to organize everything.", 'yiveno-mechanism-section.png')
await shotNear('Yiveno is the thing that finds what you saved.', 'yiveno-boundary-section.png')
await shotNear('Get Yiveno for your browser', 'yiveno-install-section.png')
await shotNear('Your memories are yours.', 'yiveno-trust-section.png')

await page.screenshot({ path: `${outDir}yiveno-com-full.png`, fullPage: true })
await browser.close()
console.log('done')
