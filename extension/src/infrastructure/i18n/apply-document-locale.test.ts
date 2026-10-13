import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'

describe('applyDocumentLocale', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      i18n: {
        getMessage: vi.fn((key: string) => {
          if (key === 'page_title_settings') {
            return 'Yiveno Settings'
          }
          return key
        }),
        getUILanguage: vi.fn(() => 'en-US')
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('设置 document lang 与 title', () => {
    applyDocumentLocale({ titleKey: 'page_title_settings' })
    expect(document.documentElement.lang).toBe('en-US')
    expect(document.title).toBe('Yiveno Settings')
  })
})
