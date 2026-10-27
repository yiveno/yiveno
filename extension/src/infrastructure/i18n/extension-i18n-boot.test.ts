import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bootExtensionPage,
  findMissingExtensionMessages,
  getCriticalMessageKeysForContentScript,
  getCriticalMessageKeysForPage,
  warnIfContentScriptMessagesMissing,
  warnIfExtensionPageMessagesMissing
} from '@/infrastructure/i18n/extension-i18n-boot'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'

describe('extension-i18n-boot', () => {
  const getMessage = vi.fn()
  const originalChrome = globalThis.chrome
  const originalDocument = globalThis.document
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
          getUILanguage: () => 'en-US'
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
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        documentElement: { lang: '' },
        title: ''
      }
    })
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({})
    })) as unknown as typeof fetch
  })

  afterEach(() => {
    setUiLocaleCatalogForTests('en', null)
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      writable: true,
      value: originalChrome
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: originalDocument
    })
    globalThis.fetch = originalFetch
  })

  it('各扩展页关键 key 含 page title 与首屏 landmark', () => {
    const settingsKeys = getCriticalMessageKeysForPage('settings')
    expect(settingsKeys).toContain('page_title_settings')
    expect(settingsKeys).toContain('settings_tabs_aria')
    expect(settingsKeys).toContain('nav_aria_label')
  })

  it('findMissingExtensionMessages 仅返回未解析 key', () => {
    getMessage.mockImplementation((key: string) =>
      key === 'library_title' ? '' : `resolved:${key}`
    )
    expect(findMissingExtensionMessages(['library_title', 'nav_aria_label'])).toEqual([
      'library_title'
    ])
  })

  it('文案齐全时不告警', () => {
    getMessage.mockImplementation((key: string) => `resolved:${key}`)
    const warnSpy = vi.spyOn(logger, 'warn')
    warnIfExtensionPageMessagesMissing('library')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('缺关键文案时打 warn 并带上 page', () => {
    getMessage.mockReturnValue('')
    const warnSpy = vi.spyOn(logger, 'warn')
    warnIfExtensionPageMessagesMissing('settings')
    expect(warnSpy).toHaveBeenCalledWith(
      'i18n',
      '关键扩展页文案未解析（将露出 message key）',
      expect.objectContaining({
        page: 'settings',
        missingKeys: expect.arrayContaining(['page_title_settings', 'settings_title'])
      })
    )
  })

  it('bootExtensionPage 设置 document lang/title', async () => {
    getMessage.mockImplementation((key: string) => `resolved:${key}`)
    // 单测默认 location 多为 http:（CS 路径会跳过 fetch）；stub 成扩展页以走目录加载分支
    vi.stubGlobal('location', { protocol: 'chrome-extension:' })
    await bootExtensionPage('detail')
    expect(document.documentElement.lang).toBe('en')
    // fetch mock 返回 ok:false → catalog null → title 走 chrome.i18n mock
    expect(document.title).toBe('resolved:page_title_detail')
  })

  it('划词浮层关键 key 含 Save / Try recall', () => {
    const keys = getCriticalMessageKeysForContentScript('selection_toolbar')
    expect(keys).toContain('context_menu_save_selection')
    expect(keys).toContain('selection_toolbar_try_recall')
    expect(keys).toContain('selection_toolbar_add_note')
  })

  it('缺划词关键文案时打 warn', () => {
    getMessage.mockReturnValue('')
    const warnSpy = vi.spyOn(logger, 'warn')
    warnIfContentScriptMessagesMissing('selection_toolbar')
    expect(warnSpy).toHaveBeenCalledWith(
      'i18n',
      '关键 content script 文案未解析（将露出 message key）',
      expect.objectContaining({
        bundle: 'selection_toolbar'
      })
    )
  })
})
