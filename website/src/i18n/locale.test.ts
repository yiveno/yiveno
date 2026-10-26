import { describe, expect, test } from 'vitest'

import {
  isChineseBrowserLanguage,
  parseWebsiteUiLocalePreference,
  resolveWebsiteUiLocale,
  toWebsiteBcp47LangTag
} from './locale'

describe('website ui locale', () => {
  test('中文系浏览器 → zh_CN；显式偏好优先', () => {
    expect(isChineseBrowserLanguage('zh-CN')).toBe(true)
    expect(resolveWebsiteUiLocale('system', 'zh-CN')).toBe('zh_CN')
    expect(resolveWebsiteUiLocale('system', 'en-US')).toBe('en')
    expect(resolveWebsiteUiLocale('en', 'zh-CN')).toBe('en')
    expect(resolveWebsiteUiLocale('zh_CN', 'en-US')).toBe('zh_CN')
  })

  test('SSR / 空 language 不抛错，回落 en', () => {
    expect(isChineseBrowserLanguage(undefined)).toBe(false)
    expect(resolveWebsiteUiLocale('system', undefined)).toBe('en')
    expect(resolveWebsiteUiLocale('system', '')).toBe('en')
  })

  test('preference 解析与 BCP 47', () => {
    expect(parseWebsiteUiLocalePreference('zh_CN')).toBe('zh_CN')
    expect(parseWebsiteUiLocalePreference('nope')).toBe('system')
    expect(toWebsiteBcp47LangTag('zh_CN')).toBe('zh-CN')
  })
})
