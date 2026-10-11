/**
 * 官网产品面文案（仅美式英语）。
 * 新增键：先写本表，再在组件用 `t('…')`；禁止在 Vue 里写死用户可见句。
 */
export const en = {
  'uninstall.meta.title': 'Quick feedback · Yiveno',
  'uninstall.meta.description':
    'Optional short feedback after removing the Yiveno extension. Website login and memories stay as they are.',

  'uninstall.feedback.title': 'What made you leave Yiveno?',
  'uninstall.feedback.lede':
    'Optional — a quick note helps us improve. Website login and your library stay as they are.',
  'uninstall.feedback.supportHintBefore': 'Need help with a bug or account issue?',
  'uninstall.feedback.supportHintLink': 'Email support@yiveno.com',
  'uninstall.feedback.supportHintAfter': '— we reply there.',
  'uninstall.feedback.reasonsLegend': 'Reason for leaving',
  'uninstall.feedback.reasonsAria': 'Reason for leaving',
  'uninstall.feedback.noteLabel': 'Anything else?',
  'uninstall.feedback.optional': '(optional)',
  'uninstall.feedback.notePlaceholder': 'A sentence is plenty.',
  'uninstall.feedback.submit': 'Send feedback',
  'uninstall.feedback.submitting': 'Sending…',
  'uninstall.feedback.honeypotLabel': 'Website',

  'uninstall.feedback.reason.didnt_find': "I couldn't find what I'd saved",
  'uninstall.feedback.reason.too_hard': 'It was confusing or hard to use',
  'uninstall.feedback.reason.missing_feature': 'Missing something I needed',
  'uninstall.feedback.reason.privacy': 'Privacy or permissions concerns',
  'uninstall.feedback.reason.bugs_or_slow': 'Bugs or it felt slow',
  'uninstall.feedback.reason.just_trying': 'I was just trying it out',
  'uninstall.feedback.reason.other': 'Something else',

  'uninstall.feedback.error.pickReason': 'Pick a reason before sending.',
  'uninstall.feedback.error.rateLimited':
    'Too many tries from this network. Please try again later.',
  'uninstall.feedback.error.sendFailed': "Couldn't send that. Please try again.",

  'uninstall.feedback.revokeFailed':
    "We couldn't finish a quiet background sign-out. Your website login and library are unchanged.",

  'uninstall.done.title': 'Thanks for the feedback',
  'uninstall.done.lede': "We'll listen and keep making Yiveno better.",
  'uninstall.done.closeHint': 'You can close this tab now.'
} as const

export type WebsiteMessageKey = keyof typeof en
