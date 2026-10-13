import { describe, expect, it, vi, beforeEach } from 'vitest'

import { clearChromeFaviconUrlCacheForTests, getChromeFaviconUrl } from './chrome-favicon'

describe('getChromeFaviconUrl', () => {
  beforeEach(() => {
    clearChromeFaviconUrlCacheForTests()
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://testid${path}`
      }
    })
  })

  it('拼出 _favicon 查询串', () => {
    const href = getChromeFaviconUrl('https://example.com/path', 16)
    const url = new URL(href)
    expect(url.pathname).toBe('/_favicon/')
    expect(url.searchParams.get('pageUrl')).toBe('https://example.com/path')
    expect(url.searchParams.get('size')).toBe('16')
  })

  it('同 origin 复用缓存 URL', () => {
    const first = getChromeFaviconUrl('https://example.com/a', 16)
    const second = getChromeFaviconUrl('https://example.com/b', 16)
    expect(second).toBe(first)
  })
})
