import { describe, expect, it } from 'vitest'

import {
  isOpenableExternalSourceUrl,
  isSavablePageUrl
} from '@/infrastructure/browser/active-tab-reader'

describe('active-tab-reader', () => {
  it('isSavablePageUrl 允许 http/https 与 Getting Started 引导页', () => {
    expect(isSavablePageUrl('https://example.com')).toBe(true)
    expect(isSavablePageUrl('http://example.com')).toBe(true)
    expect(isSavablePageUrl('chrome-extension://abc/getting-started.html')).toBe(true)
    expect(isSavablePageUrl('chrome://extensions')).toBe(false)
    expect(isSavablePageUrl('chrome-extension://abc/sidepanel.html')).toBe(false)
    expect(isSavablePageUrl('not-a-url')).toBe(false)
  })

  it('isOpenableExternalSourceUrl 仅 http/https（扩展引导页不可「打开原文」）', () => {
    expect(isOpenableExternalSourceUrl('https://example.com/a')).toBe(true)
    expect(isOpenableExternalSourceUrl('http://example.com/a')).toBe(true)
    expect(isOpenableExternalSourceUrl('chrome-extension://abc/getting-started.html')).toBe(false)
    expect(isOpenableExternalSourceUrl('chrome://extensions')).toBe(false)
    expect(isOpenableExternalSourceUrl('not-a-url')).toBe(false)
  })
})
