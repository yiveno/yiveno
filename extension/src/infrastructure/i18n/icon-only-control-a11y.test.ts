import { describe, expect, it } from 'vitest'

import {
  assertProductSurfaceLabelAllowed,
  looksLikeExposedMessageKey,
  resolveIconOnlyControlLabels
} from '@/infrastructure/i18n/icon-only-control-a11y'

describe('icon-only-control-a11y', () => {
  it('resolveIconOnlyControlLabels 配对 title 与 ariaLabel', () => {
    expect(resolveIconOnlyControlLabels('  Open library  ')).toEqual({
      title: 'Open library',
      ariaLabel: 'Open library'
    })
  })

  it('空 label 抛错', () => {
    expect(() => resolveIconOnlyControlLabels('   ')).toThrow(/不能为空/)
  })

  it('assertProductSurfaceLabelAllowed 拒绝 Search', () => {
    expect(() => assertProductSurfaceLabelAllowed('Search memories')).toThrow(/Search/)
    expect(() => assertProductSurfaceLabelAllowed('Find again')).not.toThrow()
  })

  it('looksLikeExposedMessageKey 识别常见前缀', () => {
    expect(looksLikeExposedMessageKey('settings_tabs_aria')).toBe(true)
    expect(looksLikeExposedMessageKey('Find again')).toBe(false)
    expect(looksLikeExposedMessageKey('popup_dismiss_candidates extra')).toBe(false)
  })
})
