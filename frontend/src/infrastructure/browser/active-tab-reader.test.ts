import { describe, expect, it } from 'vitest'

import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'

describe('active-tab-reader', () => {
  it('isSavablePageUrl 允许 http/https 与 Getting Started 引导页', () => {
    expect(isSavablePageUrl('https://example.com')).toBe(true)
    expect(isSavablePageUrl('http://example.com')).toBe(true)
    expect(isSavablePageUrl('chrome-extension://abc/getting-started.html')).toBe(true)
    expect(isSavablePageUrl('chrome://extensions')).toBe(false)
    expect(isSavablePageUrl('chrome-extension://abc/popup.html')).toBe(false)
    expect(isSavablePageUrl('not-a-url')).toBe(false)
  })
})
