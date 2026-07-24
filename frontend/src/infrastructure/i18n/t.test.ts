import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getUILanguage, t } from '@/infrastructure/i18n/t'

describe('i18n t()', () => {
  const getMessage = vi.fn()
  const getUILanguageMock = vi.fn(() => 'zh-CN')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      i18n: {
        getMessage,
        getUILanguage: getUILanguageMock
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('返回 getMessage 文案', () => {
    getMessage.mockReturnValue('Save to Yiveno')
    expect(t('context_menu_save_selection')).toBe('Save to Yiveno')
    expect(getMessage).toHaveBeenCalledWith('context_menu_save_selection')
  })

  it('支持 substitutions', () => {
    getMessage.mockReturnValue('Importing 3 / 10')
    expect(t('app_name', ['3', '10'])).toBe('Importing 3 / 10')
    expect(getMessage).toHaveBeenCalledWith('app_name', ['3', '10'])
  })

  it('缺文案时返回 key', () => {
    getMessage.mockReturnValue('')
    expect(t('omnibox_no_match')).toBe('omnibox_no_match')
  })

  it('getUILanguage 转发 chrome.i18n', () => {
    expect(getUILanguage()).toBe('zh-CN')
    expect(getUILanguageMock).toHaveBeenCalled()
  })
})
