import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bootExtensionPage,
  findMissingExtensionMessages,
  getCriticalMessageKeysForContentScript,
  getCriticalMessageKeysForPage,
  warnIfContentScriptMessagesMissing,
  warnIfExtensionPageMessagesMissing
} from '@/infrastructure/i18n/extension-i18n-boot'
import { logger } from '@/infrastructure/logging/logger'

describe('extension-i18n-boot', () => {
  const getMessage = vi.fn()
  const originalChrome = globalThis.chrome
  const originalDocument = globalThis.document

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      writable: true,
      value: {
        i18n: {
          getMessage,
          getUILanguage: () => 'en-US'
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
  })

  afterEach(() => {
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

  it('bootExtensionPage 设置 document lang/title', () => {
    getMessage.mockImplementation((key: string) => `resolved:${key}`)
    bootExtensionPage('detail')
    expect(document.documentElement.lang).toBe('en-US')
    expect(document.title).toBe('resolved:page_title_detail')
  })

  it('划词浮层关键 key 含 Save / Try recall', () => {
    const keys = getCriticalMessageKeysForContentScript('selection_toolbar')
    expect(keys).toContain('context_menu_save_selection')
    expect(keys).toContain('selection_toolbar_try_recall')
  })

  it('content script 缺关键文案时打 warn 并带上 bundle', () => {
    getMessage.mockReturnValue('')
    const warnSpy = vi.spyOn(logger, 'warn')
    warnIfContentScriptMessagesMissing('selection_toolbar')
    expect(warnSpy).toHaveBeenCalledWith(
      'i18n',
      '关键 content script 文案未解析（将露出 message key）',
      expect.objectContaining({
        bundle: 'selection_toolbar',
        missingKeys: expect.arrayContaining(['selection_toolbar_try_recall'])
      })
    )
  })
})
