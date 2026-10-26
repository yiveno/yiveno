import { describe, expect, it } from 'vitest'

import {
  isChineseBrowserLanguage,
  parseUiLocalePreference,
  resolveUiLocale,
  toBcp47LangTag
} from '@/core/i18n/ui-locale'

describe('ui-locale', () => {
  it('识别中文系浏览器语言', () => {
    expect(isChineseBrowserLanguage('zh-CN')).toBe(true)
    expect(isChineseBrowserLanguage('zh')).toBe(true)
    expect(isChineseBrowserLanguage('zh_Hans')).toBe(true)
    expect(isChineseBrowserLanguage('zh-TW')).toBe(true)
    expect(isChineseBrowserLanguage('en-US')).toBe(false)
    expect(isChineseBrowserLanguage('ja')).toBe(false)
  })

  it('system 跟浏览器；显式偏好优先', () => {
    expect(resolveUiLocale('system', 'zh-CN')).toBe('zh_CN')
    expect(resolveUiLocale('system', 'en-US')).toBe('en')
    expect(resolveUiLocale('en', 'zh-CN')).toBe('en')
    expect(resolveUiLocale('zh_CN', 'en-US')).toBe('zh_CN')
  })

  it('BCP 47 与 preference 解析', () => {
    expect(toBcp47LangTag('zh_CN')).toBe('zh-CN')
    expect(toBcp47LangTag('en')).toBe('en')
    expect(parseUiLocalePreference('zh_CN')).toBe('zh_CN')
    expect(parseUiLocalePreference('fr')).toBeNull()
  })
})
