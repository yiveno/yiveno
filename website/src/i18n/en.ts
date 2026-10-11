/**
 * 官网产品面文案（仅美式英语）。
 * 新增键：先写本表，再在组件用 `t('…')`；禁止在 Vue 里写死用户可见句。
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
  'uninstall.feedback.reason.other': 'Something else',

  'uninstall.feedback.error.rateLimited':
    'Too many tries from this network. Try again a bit later.',
  'uninstall.feedback.error.sendFailed': "Couldn't send that — try once more?",

  'uninstall.feedback.revokeFailed':
    "Couldn't finish a quiet sign-out in the background. Your website login and library are unchanged.",

  'uninstall.done.title': 'Thanks — that helps',
  'uninstall.done.lede': "We'll use it to make finding things better.",
  'uninstall.done.closeHint': 'You can close this tab now.'
} as const

export type WebsiteMessageKey = keyof typeof en
