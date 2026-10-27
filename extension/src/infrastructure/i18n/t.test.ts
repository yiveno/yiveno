import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getEffectiveUiLocale,
  getUILanguage,
  initUiLocaleFromSettings,
  setUiLocaleCatalogForTests,
  t
} from '@/infrastructure/i18n/t'

describe('i18n t()', () => {
  const getMessage = vi.fn()
  const getUILanguageMock = vi.fn(() => 'en-US')
  const originalChrome = globalThis.chrome
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    setUiLocaleCatalogForTests('en', null)
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      writable: true,
      value: {
        i18n: {
          getMessage,
          getUILanguage: getUILanguageMock
        },
        runtime: {
          getURL: (path: string) => `chrome-extension://test/${path}`
        },
        storage: {
          local: {
            get: vi.fn(async () => ({}))
          }
        }
      }
    })
  })

  afterEach(() => {
    setUiLocaleCatalogForTests('en', null)
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      writable: true,
      value: originalChrome
    })
    globalThis.fetch = originalFetch
  })

  it('无目录时回退 getMessage', () => {
    getMessage.mockReturnValue('Save to Yiveno')
    expect(t('context_menu_save_selection')).toBe('Save to Yiveno')
    expect(getMessage).toHaveBeenCalledWith('context_menu_save_selection')
  })

  it('支持 substitutions（chrome 路径）', () => {
    getMessage.mockReturnValue('Importing 3 / 10')
    expect(t('app_name', ['3', '10'])).toBe('Importing 3 / 10')
    expect(getMessage).toHaveBeenCalledWith('app_name', ['3', '10'])
  })

  it('缺文案时返回 key', () => {
    getMessage.mockReturnValue('')
    expect(t('omnibox_no_match')).toBe('omnibox_no_match')
  })

  it('目录优先于 chrome.i18n；getUILanguage 跟生效 locale', () => {
    setUiLocaleCatalogForTests('zh_CN', {
      context_menu_save_selection: { message: '保存到 Yiveno' },
      with_sub: { message: '导入 $1 / $2' }
    })
    expect(t('context_menu_save_selection')).toBe('保存到 Yiveno')
    expect(t('with_sub', ['3', '10'])).toBe('导入 3 / 10')
    expect(getMessage).not.toHaveBeenCalled()
    expect(getEffectiveUiLocale()).toBe('zh_CN')
    expect(getUILanguage()).toBe('zh-CN')
  })

  it('扩展页上下文 fetch 成功则目录优先', async () => {
    getUILanguageMock.mockReturnValue('zh-CN')
    vi.stubGlobal('location', { protocol: 'chrome-extension:' })
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        context_menu_save_selection: { message: '保存到 Yiveno' }
      })
    })) as unknown as typeof fetch

    const locale = await initUiLocaleFromSettings()
    expect(locale).toBe('zh_CN')
    expect(t('context_menu_save_selection')).toBe('保存到 Yiveno')
    expect(getMessage).not.toHaveBeenCalled()
  })

  it('网页 content script 上下文跳过 fetch、不告警，回退 chrome.i18n', async () => {
    getUILanguageMock.mockReturnValue('zh-CN')
    getMessage.mockReturnValue('保存到 Yiveno')
    vi.stubGlobal('location', { protocol: 'https:' })
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const locale = await initUiLocaleFromSettings()
    expect(locale).toBe('zh_CN')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(t('context_menu_save_selection')).toBe('保存到 Yiveno')
    expect(getMessage).toHaveBeenCalledWith('context_menu_save_selection')
  })
})
