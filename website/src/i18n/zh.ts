/**
 * 官网产品面简体中文文案（与 `en.ts` 键对称）。
 * 覆盖：卸载、壳导航/页脚、定价换汇、`/login`、营销首页、FAQ 可见文案。
 * 口语简体；找/找到；禁止「搜索」；禁止默认「找回」。
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
    '完全可选。一两句话能帮我们把「找到你存过的东西」做得更好——官网登录和资料库都还在。',
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
  'uninstall.done.lede': '我们会用它把找东西体验做得更好。',
  'uninstall.done.closeHint': '可以关掉这个标签页了。',

  'nav.sign_in': '登录',
  'nav.language': '语言',
  'nav.language_en': 'English',
  'nav.language_zh_CN': '简体中文',
  'nav.language_system': '跟随浏览器',
  'nav.aria_primary': '主导航',
  'footer.pricing': '定价',
  'footer.faq': '常见问题',
  'footer.support': '支持',
  'footer.privacy': '隐私',
  'footer.terms': '条款',
  'footer.tagline': '· 找到你存过的。',
  'a11y.skip_to_content': '跳到正文',

  'pricing.fx_note':
    '标价为美元（USD）。结账时总额可能按汇率显示为本地货币——不是单独的人民币套餐价。',

  'home.meta.title': 'Yiveno — 找到你存过的',
  'home.meta.description':
    'Yiveno 按你记得的样子，帮你找到存过的东西。相近的在前——你来选。面向 Edge 与 Chrome 的 Chromium 扩展。',
  'home.hero.epithet': '那个找东西的',
  'home.hero.title': '找到你存过的。',
  'home.hero.sub':
    '不用记得标题。说出你记得的——相近的在前，你来选。我们正在做面向 Edge 与 Chrome 的浏览器扩展。',

  'home.geo.title_html': 'Yiveno 就是那个<em class="home-kicker-em">找到你存过的东西的。</em>',
  'home.geo.lede': '相近的排在前面——不是保证唯一答案。你来决定。',
  'home.geo.is_label': '它是什么',
  'home.geo.is_1': '帮你找自己存过的东西',
  'home.geo.is_2': '用你记得的话说出来就能找',
  'home.geo.not_label': '它不是什么',
  'home.geo.not_1': '不是书签管理器，也不是笔记应用',
  'home.geo.not_2': '不是总能押中那一条链接的聊天机器人',

  'home.org.title': '不必把一切都整理好。',
  'home.org.lede': '看这一圈：轻轻存下来，时间过去，再用自己的话去找。',

  'home.flow.aria': 'Yiveno 的感觉：存、放下，再找',
  'home.flow.steps_aria': '流程步骤',
  'home.flow.tab_save': '存',
  'home.flow.tab_save_hint': '轻轻记下',
  'home.flow.tab_forget': '放下',
  'home.flow.tab_forget_hint': '生活继续',
  'home.flow.tab_recall': '找',
  'home.flow.tab_recall_hint': '说出你记得的',
  'home.flow.live_save': '存——轻轻记下，附注可选。',
  'home.flow.live_forget': '放下——过几个月也还是你的。',
  'home.flow.live_recall': '找——说一句线索，相近的浮上来。',
  'home.flow.toast_kicker': '已存到 Yiveno',
  'home.flow.toast_quote': '「天冷会悄悄抽走锂离子电池的电——续航先掉，电量看起来还很多。」',
  'home.flow.toast_note_html': '<em>附注</em> · 冬天续航，以后看',
  'home.flow.time_later': '八个月后',
  'home.flow.time_caption': '没有文件夹。没有完美标题。仍是你的。',
  'home.flow.panel_chip': '侧栏',
  'home.flow.clue_label': '线索',
  'home.flow.clue_text': '冬天电池那篇',
  'home.flow.hit_closest': '最接近',
  'home.flow.hit_nearby': '附近',
  'home.flow.hit_title_1': '为什么锂离子电池在寒冷中会掉容量',
  'home.flow.hit_title_2': '电动车冬天续航小贴士——我留的笔记',

  'home.capture.title': '值得记得的，先存下来。',
  'home.capture.body':
    '一页、一段、一条讨论。想加一句只有你懂的附注也行。不用文件夹、不用标签、也不用先起标题。',
  'home.capture.tag': '先存。整理以后再说——或者永远不整理。',
  'home.capture.toast_kicker': '已存到 Yiveno',
  'home.capture.toast_quote': '「海不会记账，它吞下的那些。」',
  'home.capture.toast_note_label': '附注：',
  'home.capture.toast_note_body': '开场白用得上，提醒我',

  'home.examples.title_html': '记得大意就够。<em class="home-kicker-em">这样就行。</em>',
  'home.examples.body': '怎么记得就怎么说——日常、含糊也没关系。相近的会出现在侧栏里。',
  'home.examples.panel_aria': '用口语线索找到已存文章的示例',
  'home.examples.panel_chip': '侧栏',
  'home.examples.clue_label': '线索',
  'home.examples.clue_text': '冬天电池掉得快的那篇',
  'home.examples.rank_closest': '最接近',
  'home.examples.rank_nearby': '附近',
  'home.examples.card_1_title': '为什么锂离子电池在寒冷中会掉容量',
  'home.examples.card_1_meta': '八个月前存的 · 摘录',
  'home.examples.card_2_title': '电动车冬天续航小贴士——我留的笔记',
  'home.examples.card_2_meta': '去年冬天存的 · 附注',
  'home.examples.card_3_title': '电池化学科普（书签）',
  'home.examples.card_3_meta': '一年前存的 · 书签',
  'home.examples.caption': '不必记得确切标题——相近的在前，你来选。',

  'home.install.title': '把 Yiveno 装到你的浏览器',
  'home.install.lede':
    '面向 Microsoft Edge 与 Chrome 的 Chromium 扩展——找你存过的东西，体验一样。大陆桌面：上架后以 Edge 扩展商店为主路径。',
  'home.install.chrome': '获取 Chrome 版',
  'home.install.chrome_soon': '获取 Chrome 版 — 即将推出',
  'home.install.edge': '获取 Microsoft Edge 版',
  'home.install.edge_soon': '获取 Microsoft Edge 版 — 即将推出',
  'home.install.edge_secondary': 'Microsoft Edge',
  'home.install.edge_secondary_soon': 'Microsoft Edge — 即将推出',
  'home.install.cws_secondary': 'Chrome 应用商店',
  'home.install.cws_secondary_soon': 'Chrome 应用商店 — 即将推出',
  'home.install.note': '公开商店尚未上架。我们不会把侧载 ZIP 当作主要安装方式。',

  'home.trust.title': '你的记忆是你的。',
  'home.trust.1': '你存过的东西默认只在你这边——别人看不见。',
  'home.trust.2': '你可以随时彻底删掉存过的内容。',
  'home.trust.3': '我们不出售你的收藏，也不与第三方分享。',
  'home.trust.4': '我们不会用你存过的内容去训练公开模型。',

  'faq.meta.title': '常见问题 · Yiveno',
  'faq.meta.description':
    'Yiveno 是什么、不是什么，Recall 怎么工作，隐私默认，Free / Pro，以及商店上架状态。',
  'faq.title': '常见问题',
  'faq.lede_before': '关于「找到你存过的东西」的短答。遇到 bug 或账号问题，见',
  'faq.lede_support': '支持',
  'faq.lede_after': '。',
  'faq.what_is.q': 'Yiveno 是什么？',
  'faq.what_is.a':
    'Yiveno 就是那个找到你存过的东西的。轻轻存下页面或段落，再说出你记得的内容来找。它给出一小份相近列表——你来选。它是面向 Microsoft Edge 与 Google Chrome 的 Chromium 浏览器扩展。',
  'faq.what_isnt.q': 'Yiveno 不是什么？',
  'faq.what_isnt.a':
    'Yiveno 的主承诺不是书签管理器、笔记应用、聊天机器人或 AI 整理工具。它不声称永远押中那一条链接；相近结果是建议，不是神谕。',
  'faq.recall.q': 'Recall（找）怎么工作？',
  'faq.recall.a':
    '用日常语言输入一条线索——不必记得确切标题。Yiveno 会排出与你记忆最贴近的邻域。置顶建议只是建议；哪一条对，由你决定。',
  'faq.data.q': '我的数据存在哪里？',
  'faq.data.a':
    '默认情况下，你存下的内容留在本机（本地 IndexedDB）。登录本身不会上传资料库。摘录云同步是可选的，并绑定账户。我们不出售你的收藏，也不用你存过的内容训练公开模型。',
  'faq.pricing.q': 'Free 和 Pro 有什么区别？',
  'faq.pricing.a':
    '本机找东西的质量，Free 与 Pro 相同。Free 为 $0。Pro 展示价为每月 $7.99 或每年 $59.99（美元），并增加跨设备摘录同步，以及更高的云端线索协助额度。结账以美元标价；收据上的本地货币可能反映汇率。',
  'faq.install.q': '现在能安装 Yiveno 吗？',
  'faq.install.a':
    '目前还不能从公开的 Chrome 应用商店或 Microsoft Edge 扩展商店安装。上架后，大陆桌面以 Edge 扩展商店为主。我们不会把侧载 ZIP 当作主要安装方式。'
} as const satisfies Record<WebsiteMessageKey, string>
