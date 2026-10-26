import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'

describe('applyDocumentLocale', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      page_title_settings: { message: 'Yiveno Settings' }
    })
    vi.stubGlobal('chrome', {
      i18n: {
        getMessage: vi.fn((key: string) => key),
        getUILanguage: vi.fn(() => 'en-US')
      }
    })
  })

  afterEach(() => {
    setUiLocaleCatalogForTests('en', null)
    vi.unstubAllGlobals()
  })

  it('设置 document lang 与 title（跟生效 UI locale）', () => {
    applyDocumentLocale({ titleKey: 'page_title_settings' })
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Yiveno Settings')
  })
})
