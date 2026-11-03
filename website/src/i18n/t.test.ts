import { describe, expect, test } from 'vitest'
import { en } from './en'
import { t, tFormat } from './t'
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

  test('login 核心键中英齐全', () => {
    const keys = [
      'login.title',
      'login.cta.send',
      'login.useDifferentEmail',
      'login.hint.default',
      'login.error.generic'
    ] as const
    for (const key of keys) {
      expect(t(key, 'en').length).toBeGreaterThan(0)
      expect(t(key, 'zh_CN').length).toBeGreaterThan(0)
    }
    expect(t('login.title', 'zh_CN')).toBe('登录 Yiveno')
    expect(t('login.useDifferentEmail', 'zh_CN')).toBe('换个邮箱')
  })

  test('tFormat 替换占位', () => {
    expect(tFormat('login.toast.codeSent', { email: 'a@b.co' }, 'en')).toBe('Code sent to a@b.co')
    expect(tFormat('login.toast.codeSent', { email: 'a@b.co' }, 'zh_CN')).toBe(
      '验证码已发到 a@b.co'
    )
    expect(tFormat('login.error.otpIncomplete', { digits: 8 }, 'zh_CN')).toContain('8')
  })

  test('首页 / FAQ / 页脚键中英齐全且不用「找回」默认译', () => {
    expect(t('home.hero.title', 'zh_CN')).toBe('找到你存过的。')
    expect(t('home.hero.title', 'zh_CN')).not.toMatch(/找回/)
    expect(t('footer.tagline', 'zh_CN')).toBe('· 找到你存过的。')
    expect(t('footer.faq', 'zh_CN')).toBe('常见问题')
    expect(t('faq.what_is.q', 'zh_CN')).toContain('Yiveno')
    expect(t('home.geo.title_html', 'zh_CN')).toContain('home-kicker-em')
  })

  test('pricing / account / support / legal 壳键中英齐全', () => {
    const keys = [
      'pricing.title',
      'pricing.pro.subscribe',
      'pricing.fx_note',
      'account.sign_out',
      'account.upgrade',
      'account.checkout.pending',
      'support.title',
      'support.bugs.title',
      'privacy.title',
      'privacy.translation_note',
      'terms.title',
      'terms.translation_note'
    ] as const
    for (const key of keys) {
      expect(t(key, 'en').length).toBeGreaterThan(0)
      expect(t(key, 'zh_CN').length).toBeGreaterThan(0)
    }
    expect(t('pricing.title', 'zh_CN')).toBe('定价')
    expect(t('account.sign_out', 'zh_CN')).toBe('退出登录')
    expect(t('support.title', 'zh_CN')).toBe('支持')
    expect(t('privacy.translation_note', 'zh_CN')).toMatch(/英文/)
  })
})
