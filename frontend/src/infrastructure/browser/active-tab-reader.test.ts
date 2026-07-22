import { describe, expect, it } from 'vitest'

import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'

describe('active-tab-reader', () => {
  it('isSavablePageUrl 仅允许 http/https', () => {
    expect(isSavablePageUrl('https://example.com')).toBe(true)
    expect(isSavablePageUrl('http://example.com')).toBe(true)
    expect(isSavablePageUrl('chrome://extensions')).toBe(false)
    expect(isSavablePageUrl('chrome-extension://abc/popup.html')).toBe(false)
    expect(isSavablePageUrl('not-a-url')).toBe(false)
  })
})
