import { describe, expect, test } from 'vitest'
import { en } from './en'
import { t } from './t'

describe('website i18n t()', () => {
  test('已知键返回 en 文案', () => {
    expect(t('uninstall.done.closeHint')).toBe('You can close this tab now.')
    expect(t('uninstall.done.closeHint')).toBe(en['uninstall.done.closeHint'])
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
      expect(t(key).length).toBeGreaterThan(0)
    }
  })
})
