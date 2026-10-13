/**
 * 扩展页 HTML favicon 契约：链到 manifest 同源 icon16/32。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  EXTENSION_PAGE_FAVICON_SIZES,
  extensionPageFaviconHref
} from '@/core/extension/extension-icon-contract'

const pagesRoot = resolve(import.meta.dirname, '../../pages')
const publicRoot = resolve(import.meta.dirname, '../../../public')

const VITE_EXTENSION_PAGE_HTML_PATHS = [
  'sidepanel/index.html',
  'settings/index.html',
  'detail/index.html',
  'library/index.html',
  'getting-started/index.html'
] as const

function expectExtensionPageFaviconLinks(html: string, rootRelative: boolean): void {
  for (const size of EXTENSION_PAGE_FAVICON_SIZES) {
    const href = extensionPageFaviconHref(size, { rootRelative })
    const sizes = size === '32' ? '32x32' : '16x16'
    expect(html).toContain(`rel="icon"`)
    expect(html).toContain(`sizes="${sizes}"`)
    expect(html).toContain(`href="${href}"`)
  }
}

describe('extension page favicon 契约', () => {
  it('Vite 扩展页链 icon32 + icon16（根路径，clean-dist 会改相对）', () => {
    for (const pagePath of VITE_EXTENSION_PAGE_HTML_PATHS) {
      const html = readFileSync(resolve(pagesRoot, pagePath), 'utf8')
      expectExtensionPageFaviconLinks(html, true)
    }
  })

  it('offscreen.html 链 icon32 + icon16（相对路径）', () => {
    const html = readFileSync(resolve(publicRoot, 'offscreen.html'), 'utf8')
    expectExtensionPageFaviconLinks(html, false)
  })
})
