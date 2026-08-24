import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { warnIfCriticalExtensionMessagesMissing } from '@/infrastructure/i18n/validate-critical-extension-messages'
import { logger } from '@/infrastructure/logging/logger'

describe('warnIfCriticalExtensionMessagesMissing', () => {
  const getMessage = vi.fn()
  const originalChrome = globalThis.chrome

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
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      writable: true,
      value: originalChrome
    })
  })

  it('Mark 文案齐全时不告警', () => {
    getMessage.mockImplementation((key: string) => {
      if (key === 'popup_mark_as_meant') {
        return 'Mark as what I meant'
      }
      if (key === 'popup_mark_as_meant_done') {
        return 'Marked as what you meant'
      }
      return `resolved:${key}`
    })
    const warnSpy = vi.spyOn(logger, 'warn')
    warnIfCriticalExtensionMessagesMissing()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('缺 Mark 文案时打 warn 并列出 key', () => {
    getMessage.mockReturnValue('')
    const warnSpy = vi.spyOn(logger, 'warn')
    warnIfCriticalExtensionMessagesMissing()
    expect(warnSpy).toHaveBeenCalledWith(
      'i18n',
      '关键 Side Panel 文案未解析（将露出 message key）',
      expect.objectContaining({
        missingKeys: expect.arrayContaining(['popup_mark_as_meant', 'popup_mark_as_meant_done'])
      })
    )
  })
})
