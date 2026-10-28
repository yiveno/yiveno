/**
 * 官网产品面简体中文文案（与 `en.ts` 键对称）。
 * 当前覆盖：卸载反馈页 + 语言切换控件；营销首页等仍多为页面内英文硬编码。
 */
import type { WebsiteMessageKey } from './en'

export const zh = {
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
