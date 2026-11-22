import { describe, expect, it } from 'vitest'

import {
  isSamePageContextDomain,
  normalizePageContextDomain,
  PAGE_CONTEXT_MODES,
  urlForPageContext
} from '@/core/recall/page-context-mode'

describe('PAGE_CONTEXT_MODES', () => {
  it('闭集为 none / boost / restrict', () => {
    expect([...PAGE_CONTEXT_MODES]).toEqual(['none', 'boost', 'restrict'])
  })
})

describe('urlForPageContext', () => {
  it('普通网页用活动标签地址', () => {
    expect(urlForPageContext({ url: 'https://example.com/a' })).toBe('https://example.com/a')
  })

  it('chrome 内置页不回退到别的域名', () => {
    expect(urlForPageContext({ url: 'chrome://extensions' })).toBeUndefined()
    expect(urlForPageContext({ url: 'chrome-extension://abc/sidepanel.html' })).toBeUndefined()
  })

  it('地址未到时可用 pending 的普通网页', () => {
    expect(urlForPageContext({ pendingUrl: 'https://news.example/x' })).toBe(
      'https://news.example/x'
    )
  })
})

describe('normalizePageContextDomain / isSamePageContextDomain', () => {
  it('去 www. 与大小写', () => {
    expect(normalizePageContextDomain('WWW.Example.COM')).toBe('example.com')
    expect(isSamePageContextDomain('www.example.com', 'Example.com')).toBe(true)
  })

  it('子域不与父域等同', () => {
    expect(isSamePageContextDomain('docs.example.com', 'example.com')).toBe(false)
  })
})
