/**
 * 官网产品面简体中文文案（与 `en.ts` 键对称）。
 * 当前覆盖：卸载反馈、壳导航/页脚、定价换汇说明、`/login`；营销首页等仍可能硬编码英文。
 */
import type { WebsiteMessageKey } from './en'

export const zh = {
  'login.meta.title': '登录 · Yiveno',
  'login.meta.description': '登录 Yiveno 以管理账户与账单。你存过的东西仍在本机，除非你打开同步。',

  'login.title': '登录 Yiveno',
  'login.hint.redirecting': '正在进入你的账户…',
  'login.hint.subscribe': '登录后继续结账。完成后我们会把你带回定价页。',
  'login.hint.extension': '把本机扩展接到你的账户。你存过的东西仍在本机——同步是可选的。',
  'login.hint.default': '用于账户与账单。你存过的东西仍在本机——同步是可选的。',

  'login.email.label': '邮箱',
  'login.email.placeholder': 'you@example.com',
  'login.otp.label': '验证码',
  'login.turnstile.aria': '人机验证',
  'login.resend.aria': '重新发送登录验证码',
  'login.resend.beforeSeconds': '还有',
  'login.resend.afterSeconds': '秒可重发',
  'login.resend.idle': '重发',
  'login.resend.preparing': '准备中…',
  'login.useDifferentEmail': '换个邮箱',

  'login.cta.send': '发验证码到邮箱',
  'login.cta.sending': '发送中…',
  'login.cta.verify': '验证并继续',
  'login.cta.verifying': '验证中…',

  'login.divider.or': '或',
  'login.oauth.groupAria': '用第三方账号登录',
  'login.oauth.google': '使用 Google 登录',
  'login.oauth.microsoft': '使用 Microsoft 登录',
  'login.oauth.redirecting': '正在跳转…',

  'login.toast.connectingExtension': '正在连接扩展…',
  'login.toast.extensionConnected': '扩展已连接',
  'login.toast.codeSent': '验证码已发到 {email}',
  'login.toast.newCodeSent': '新验证码已发到 {email}',
  'login.toast.resendWait': '请再等 {seconds} 秒再重新获取验证码。',

  'login.error.connectExtension': '没能连上扩展。请先装好 Yiveno，再点 Connect 重试。',
  'login.error.noToken': '登录没完成。请再试一次。',
  'login.error.sessionError': '没法保存登录状态',
  'login.error.authError': '登录意外失败了',
  'login.error.oauthError': '没能用该账号完成登录。请再试一次，或改用邮箱。',
  'login.error.generic': '登录失败。请再试一次。',
  'login.error.turnstileNotConfigured':
    '邮箱登录的人机验证还没配好。请改用 Google / Microsoft，或请站点管理员完成配置。',
  'login.error.turnstileLoadFailed': '人机验证加载失败。请改用 Google / Microsoft。',
  'login.error.checkSession': '没法确认登录状态',
  'login.error.invalidEmail': '请输入有效的邮箱地址。',
  'login.error.botCheckPending': '人机验证还在进行。稍等一下再试。',
  'login.error.sendFailed': '验证码没发出去。请检查邮箱地址后再试。',
  'login.error.resendFailed': '没法重发验证码。请稍等一分钟再试。',
  'login.error.otpIncomplete': '请输入邮件里的 {digits} 位验证码。',
  'login.error.captcha': '人机验证没通过。刷新后再试，或改用 Google / Microsoft。',
  'login.error.sendEmailFailed': '邮件暂时发不出去。请稍等一分钟再试，或改用 Google / Microsoft。',
  'login.error.rateLimited': '尝试太多次了。请等一分钟再试。',
  'login.error.otpInvalid': '验证码无效或已过期。请重新获取一个。',

  'uninstall.meta.title': '简单说两句 · Yiveno',
  'uninstall.meta.description': '卸载 Yiveno 扩展后可选填写反馈。官网登录与资料库不受影响。',

  'uninstall.feedback.title': '是什么让你离开？',
  'uninstall.feedback.lede':
    '完全可选。一两句话能帮我们把「找回你存过的东西」做得更好——官网登录和资料库都还在。',
  'uninstall.feedback.supportHintBefore': '遇到 bug 或账号问题？',
  'uninstall.feedback.supportHintLink': '发邮件到 support@yiveno.com',
  'uninstall.feedback.supportHintAfter': '——我们会在那里回复。',
  'uninstall.feedback.reasonsLegend': '离开原因（可多选）',
  'uninstall.feedback.reasonsAria': '离开原因 — 可多选',
  'uninstall.feedback.noteLabel': '还有别的吗？',
  'uninstall.feedback.optional': '（可选）',
  'uninstall.feedback.notePlaceholder': '一句话就够。',
  'uninstall.feedback.submit': '发送',
  'uninstall.feedback.submitting': '发送中…',
  'uninstall.feedback.honeypotLabel': '网站',

  'uninstall.feedback.reason.didnt_find': '找不到我存过的东西',
  'uninstall.feedback.reason.too_hard': '感觉难用或不好懂',
  'uninstall.feedback.reason.missing_feature': '缺了我需要的功能',
  'uninstall.feedback.reason.privacy': '隐私或权限让我不放心',
  'uninstall.feedback.reason.bugs_or_slow': '有 bug，或感觉很慢',
  'uninstall.feedback.reason.just_trying': '只是随便试试',
  'uninstall.feedback.reason.other': '都不是 — 我想自己写',
  'uninstall.feedback.customLabel': '你的原因',
  'uninstall.feedback.customPlaceholder': '几个字就行。',

  'uninstall.feedback.error.rateLimited': '这个网络请求太频繁了，稍后再试一次。',
  'uninstall.feedback.error.sendFailed': '没发出去 — 再试一次？',

  'uninstall.feedback.revokeFailed': '后台静默退出没完成。你的官网登录和资料库没有变化。',

  'uninstall.done.title': '谢谢，这很有帮助',
  'uninstall.done.lede': '我们会用它把找回体验做得更好。',
  'uninstall.done.closeHint': '可以关掉这个标签页了。',

  'nav.sign_in': '登录',
  'nav.language': '语言',
  'nav.language_en': 'English',
  'nav.language_zh_CN': '简体中文',
  'nav.language_system': '跟随浏览器',
  'nav.aria_primary': '主导航',
  'footer.support': '支持',
  'footer.privacy': '隐私',
  'footer.terms': '条款',
  'footer.tagline': '· 找回你存过的。',
  'a11y.skip_to_content': '跳到正文',

  'pricing.fx_note':
    '标价为美元（USD）。结账时总额可能按汇率显示为本地货币——不是单独的人民币套餐价。'
} as const satisfies Record<WebsiteMessageKey, string>
