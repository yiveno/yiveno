/**
 * 官网产品面英文文案（美式英语；与 `zh.ts` 键对称）。
 * 新增键：先写本表与 zh，再在组件用 `t('…')` / `tFormat('…', vars)`；禁止在 Vue 里写死用户可见句。
 * 已覆盖：卸载反馈、壳导航/页脚、定价换汇说明、`/login`。营销首页等大段仍可能硬编码英文。
 */
export const en = {
  'login.meta.title': 'Sign in · Yiveno',
  'login.meta.description':
    "Sign in to Yiveno for your account and billing. What you've saved stays on this device unless you turn sync on.",

  'login.title': 'Sign in to Yiveno',
  'login.hint.redirecting': 'Taking you to your account…',
  'login.hint.subscribe':
    "Sign in to continue checkout. We'll bring you back to pricing to finish.",
  'login.hint.extension':
    "Connect this extension to your account. What you've saved stays on this device — sync is optional.",
  'login.hint.default':
    "For account and billing. What you've saved stays on this device — sync is optional.",

  'login.email.label': 'Email',
  'login.email.placeholder': 'you@example.com',
  'login.otp.label': 'Code',
  'login.turnstile.aria': 'Bot check',
  'login.resend.aria': 'Resend sign-in code',
  /** UI：`Resend in {seconds}s` — 秒数单独包 span 做跳动，见 LoginForm */
  'login.resend.beforeSeconds': 'Resend in',
  'login.resend.afterSeconds': 's',
  'login.resend.idle': 'Resend',
  'login.resend.preparing': 'Preparing…',
  'login.useDifferentEmail': 'Use a different email',

  'login.cta.send': 'Email me a code',
  'login.cta.sending': 'Sending…',
  'login.cta.verify': 'Verify and continue',
  'login.cta.verifying': 'Verifying…',

  'login.divider.or': 'or',
  'login.oauth.groupAria': 'Sign in with a provider',
  'login.oauth.google': 'Sign in with Google',
  'login.oauth.microsoft': 'Sign in with Microsoft',
  'login.oauth.redirecting': 'Redirecting…',

  'login.toast.connectingExtension': 'Connecting to the extension…',
  'login.toast.extensionConnected': 'Extension connected',
  'login.toast.codeSent': 'Code sent to {email}',
  'login.toast.newCodeSent': 'New code sent to {email}',
  'login.toast.resendWait': 'Please wait {seconds}s before requesting another code.',

  'login.error.connectExtension':
    'Could not connect the extension. Install Yiveno and try Connect again.',
  'login.error.noToken': "Sign-in didn't finish. Please try again.",
  'login.error.sessionError': 'Could not save your sign-in session',
  'login.error.authError': 'Sign-in failed unexpectedly',
  'login.error.oauthError':
    "We couldn't finish sign-in with that provider. Try again or use email.",
  'login.error.generic': 'Sign-in failed. Please try again.',
  'login.error.turnstileNotConfigured':
    'Email sign-in bot check is not configured. Use Google / Microsoft, or ask the site owner to finish setup.',
  'login.error.turnstileLoadFailed': 'Bot check failed to load. Try Google / Microsoft.',
  'login.error.checkSession': 'Could not check sign-in status',
  'login.error.invalidEmail': 'Enter a valid email address.',
  'login.error.botCheckPending': 'Bot check is still running. Wait a moment and try again.',
  'login.error.sendFailed': "We couldn't send a code. Check the address and try again.",
  'login.error.resendFailed': "We couldn't resend the code. Try again in a minute.",
  'login.error.otpIncomplete': 'Enter the {digits}-digit code from your email.',
  'login.error.captcha': 'Bot check failed. Refresh and try again, or use Google / Microsoft.',
  'login.error.sendEmailFailed':
    "We couldn't send the email right now. Try again in a minute, or use Google / Microsoft.",
  'login.error.rateLimited': 'Too many attempts. Wait a minute and try again.',
  'login.error.otpInvalid': 'That code is invalid or expired. Request a new one.',

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

  'nav.sign_in': 'Sign in',
  'nav.language': 'Language',
  'nav.language_en': 'English',
  'nav.language_zh_CN': '简体中文',
  'nav.language_system': 'Match browser',
  'nav.aria_primary': 'Primary',
  'footer.support': 'Support',
  'footer.privacy': 'Privacy',
  'footer.terms': 'Terms',
  'footer.tagline': '· Find what you saved.',
  'a11y.skip_to_content': 'Skip to content',

  /** `.cn` 定价页：诚实说明换汇，非独立人民币套餐价 */
  'pricing.fx_note':
    'Listed prices are in USD. At checkout, your total may show in a local currency converted from this price.'
} as const

export type WebsiteMessageKey = keyof typeof en
