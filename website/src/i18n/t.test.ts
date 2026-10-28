import { describe, expect, test } from 'vitest'
import { en } from './en'
import { t } from './t'
import { zh } from './zh'

describe('website i18n t()', () => {
  test('en 键返回英文', () => {
    expect(t('uninstall.done.closeHint', 'en')).toBe('You can close this tab now.')
    expect(t('uninstall.done.closeHint', 'en')).toBe(en['uninstall.done.closeHint'])
    expect(t('uninstall.feedback.title', 'en')).toBe('What made you leave?')
  })

  test('zh_CN 键返回中文', () => {
    expect(t('uninstall.done.closeHint', 'zh_CN')).toBe(zh['uninstall.done.closeHint'])
    expect(t('uninstall.feedback.title', 'zh_CN')).toBe('是什么让你离开？')
    expect(t('footer.support', 'zh_CN')).toBe('支持')
  })

  test('en / zh 键集合对称', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  test('pricing.fx_note 中英均有诚实换汇说明', () => {
    expect(t('pricing.fx_note', 'en')).toMatch(/USD/i)
    expect(t('pricing.fx_note', 'en')).toMatch(/local currency/i)
    expect(t('pricing.fx_note', 'zh_CN')).toMatch(/美元|USD/)
    expect(t('pricing.fx_note', 'zh_CN')).toMatch(/本地货币|汇率/)
  })

  test('卸载原因键齐全', () => {
    const keys = [
      'uninstall.feedback.reason.didnt_find',
      'uninstall.feedback.reason.too_hard',
      'uninstall.feedback.reason.missing_feature',
      'uninstall.feedback.reason.privacy',
      'uninstall.feedback.reason.bugs_or_slow',
      'uninstall.feedback.reason.just_trying',
      'uninstall.feedback.reason.other'
    ] as const
    for (const key of keys) {
      expect(t(key, 'en').length).toBeGreaterThan(0)
      expect(t(key, 'zh_CN').length).toBeGreaterThan(0)
    }
  })
})
