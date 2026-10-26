/**
 * 官网产品面英文文案（美式英语；与 `zh.ts` 键对称）。
 * 新增键：先写本表与 zh，再在组件用 `t('…')`；禁止在 Vue 里写死用户可见句。
 * 营销首页等大段文案仍多为 Astro 硬编码英文——见国内化审计报告缺口。
 */
export const en = {
  'uninstall.meta.title': 'Quick note · Yiveno',
  'uninstall.meta.description':
    'Optional note after removing the Yiveno extension. Website login and your library stay put.',

  'uninstall.feedback.title': 'What made you leave?',
  'uninstall.feedback.lede':
    'Totally optional. A quick note helps us get better at finding what you saved — your website login and library stay put.',
  'uninstall.feedback.supportHintBefore': 'Bug or account snag?',
  'uninstall.feedback.supportHintLink': 'Email support@yiveno.com',
  'uninstall.feedback.supportHintAfter': '— we write back there.',
  'uninstall.feedback.reasonsLegend': 'Why you left (pick any that apply)',
  'uninstall.feedback.reasonsAria': 'Why you left — pick any that apply',
  'uninstall.feedback.noteLabel': 'Anything else?',
  'uninstall.feedback.optional': '(optional)',
  'uninstall.feedback.notePlaceholder': 'A sentence is plenty.',
  'uninstall.feedback.submit': 'Send it',
  'uninstall.feedback.submitting': 'Sending…',
  'uninstall.feedback.honeypotLabel': 'Website',

  'uninstall.feedback.reason.didnt_find': "Couldn't find what I'd saved",
  'uninstall.feedback.reason.too_hard': 'Felt confusing or hard to use',
  'uninstall.feedback.reason.missing_feature': 'Missing something I needed',
  'uninstall.feedback.reason.privacy': 'Privacy or permissions felt off',
  'uninstall.feedback.reason.bugs_or_slow': 'Bugs, or it felt slow',
  'uninstall.feedback.reason.just_trying': 'Just trying it out',
  'uninstall.feedback.reason.other': "None of these — I'll write my own",
  'uninstall.feedback.customLabel': 'Your reason',
  'uninstall.feedback.customPlaceholder': 'A few words is enough.',

  'uninstall.feedback.error.rateLimited':
    'Too many tries from this network. Try again a bit later.',
  'uninstall.feedback.error.sendFailed': "Couldn't send that — try once more?",

  'uninstall.feedback.revokeFailed':
    "Couldn't finish a quiet sign-out in the background. Your website login and library are unchanged.",

  'uninstall.done.title': 'Thanks — that helps',
  'uninstall.done.lede': "We'll use it to make finding things better.",
  'uninstall.done.closeHint': 'You can close this tab now.',

  'nav.support': 'Support',
  'nav.language': 'Language',
  'nav.language_en': 'English',
  'nav.language_zh_CN': '简体中文',
  'nav.language_system': 'Match browser',
  'nav.aria_primary': 'Primary',
  'footer.support': 'Support',
  'footer.privacy': 'Privacy',
  'footer.terms': 'Terms',
  'a11y.skip_to_content': 'Skip to content'
} as const

export type WebsiteMessageKey = keyof typeof en
