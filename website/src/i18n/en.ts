/**
 * 官网产品面英文文案（美式英语；与 `zh.ts` 键对称）。
 * 新增键：先写本表与 zh，再在组件用 `t('…')` / `data-yiveno-i18n` / `tFormat`；禁止写死用户可见句。
 * 覆盖：卸载、壳导航/页脚、Pricing/Account/Support、法律页壳键、`/login`、营销首页、FAQ（JSON-LD 仍英文 FAQ_ENTRIES）。
 * Privacy/Terms 长文：同页双语 prose（`data-yiveno-legal-locale`），不进本字典。
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
  'footer.pricing': 'Pricing',
  'footer.faq': 'FAQ',
  'footer.support': 'Support',
  'footer.privacy': 'Privacy',
  'footer.terms': 'Terms',
  'footer.tagline': '· Find what you saved.',
  'a11y.skip_to_content': 'Skip to content',

  /** `.cn` 定价页：诚实说明换汇，非独立人民币套餐价 */
  'pricing.fx_note':
    'Listed prices are in USD. At checkout, your total may show in a local currency converted from this price.',
  'pricing.meta.title': 'Pricing · Yiveno',
  'pricing.meta.description':
    'Yiveno Free and Pro: same find quality on your device. Pro adds library sync and more room for cloud help with your clues. Prices in USD.',
  'pricing.title': 'Pricing',
  'pricing.lede':
    'Find what you saved: capture lightly, get a short list of closest fits — you pick. Free and Pro find just as well on your device; Pro syncs your library and gives you more room for cloud help with your clues.',
  'pricing.cycle.aria': 'Pro billing period',
  'pricing.cycle.month': 'Monthly',
  'pricing.cycle.year': 'Yearly',
  'pricing.interval.month': '/mo',
  'pricing.interval.year': '/yr',
  'pricing.free.tier': 'Free',
  'pricing.free.desc': 'Find from what you saved — on your device. No cloud sync.',
  'pricing.free.f1': 'Capture excerpts & bookmarks',
  'pricing.free.f2': 'Find closest fits on your device',
  'pricing.free.f3': 'Local library, notes, export',
  'pricing.free.f4': 'Sign in: a little cloud clue help each month',
  'pricing.free.cta': 'Sign in',
  'pricing.pro.tier': 'Pro',
  'pricing.pro.desc':
    'Same find quality as Free, plus sync across devices and a higher limit for cloud help with your clues.',
  'pricing.pro.f1': 'Same find quality as Free',
  'pricing.pro.f2': 'Cloud sync across devices',
  'pricing.pro.f3': 'Higher limit for cloud clue help',
  'pricing.pro.f4': 'Higher daily limit for smarter matching in the cloud',
  'pricing.pro.manage': 'Manage subscription',
  'pricing.pro.subscribe': 'Subscribe',
  'pricing.pro.sign_in_subscribe': 'Sign in to subscribe',
  'pricing.pro.opening': 'Opening…',
  'pricing.error.already_pro': 'This account already has Pro. Manage it from your subscription.',
  'pricing.error.checkout_failed': 'Could not start checkout. Try again.',
  'pricing.footnote':
    'Roadmap only (not for sale): Power User, Team. Displayed totals are list prices before tax. Checkout happens on our secure checkout page after you sign in.',

  'account.meta.title': 'Account · Yiveno',
  'account.meta.description': 'Your Yiveno account, plan, and billing.',
  'account.sign_out': 'Sign out',
  'account.plan_heading': 'Plan',
  'account.checking_plan': 'Checking your plan…',
  'account.plan.pro': 'Pro',
  'account.plan.free': 'Free',
  'account.plan.load_failed': "Couldn't load plan",
  'account.plan.updating': 'Updating…',
  'account.plan.verify_error':
    "We couldn't verify your plan right now. Your paid access is unchanged if you already subscribe.",
  'account.plan.renews': 'Renews / ends {date}',
  'account.retry': 'Retry',
  'account.upgrade': 'Upgrade to Pro',
  'account.manage': 'Manage subscription',
  'account.view_pricing': 'View pricing',
  'account.opening': 'Opening…',
  'account.loading': 'Loading…',
  'account.dismiss': 'Dismiss',
  'account.provider.unknown': 'Unknown',
  'account.provider.google': 'Google',
  'account.provider.microsoft': 'Microsoft',
  'account.provider.email': 'Email',
  'account.checkout.pending':
    'Checking your checkout. If you paid, Pro usually shows within a few seconds — refresh if the plan below still says Free.',
  'account.checkout.failed': "Payment didn't go through. You can try Upgrade to Pro again.",
  'account.checkout.error': 'Could not start checkout. Try again.',
  'account.date.unknown': 'Unknown',

  'support.meta.title': 'Support · Yiveno',
  'support.meta.description':
    'Get help with Yiveno — bugs, account, billing, and install questions by email. We reply at support@yiveno.com.',
  'support.title': 'Support',
  'support.lede_before': 'Need a reply? Email us. For product ideas that don’t need a reply, use',
  'support.lede_mid': 'or the optional form if you remove the extension. Short product answers:',
  'support.lede_faq': 'FAQ',
  'support.lede_after': '.',
  'support.bugs.title': 'Bugs & account help',
  'support.bugs.body_before': 'Something broken, can’t sign in, sync issues, or billing questions:',
  'support.bugs.hint':
    'Include what you tried, your browser (Edge or Chrome) and version, and the extension version if you can — one clear note helps us reply once.',
  'support.install.title': 'Install availability',
  'support.install.body_before':
    'Yiveno is not listed on the public Chrome Web Store or Microsoft Edge Add-ons yet. If you want a notice when a public listing is available, email',
  'support.install.body_after': 'with the subject "Install notify".',
  'support.ideas.title': 'Product ideas',
  'support.ideas.body_before': 'Feature ideas or “why I left” style notes (no reply expected):',
  'support.privacy.title': 'Privacy',
  'support.privacy.body_before': 'Privacy questions:',
  'support.privacy.policy': 'Privacy Policy',

  'privacy.meta.title': 'Privacy Policy · Yiveno',
  'privacy.meta.description':
    'How Yiveno handles personal data for the Chromium extension (Edge and Chrome) and website: local-first memory, optional cloud sync, account, and AI.',
  'privacy.title': 'Privacy Policy',
  'privacy.effective': 'Effective date: {date}',
  'privacy.translation_note':
    'Convenience translation. If anything conflicts with the English text, the English version controls.',

  'terms.meta.title': 'Terms of Service · Yiveno',
  'terms.meta.description':
    'Terms of Service for the Yiveno Chromium extension (Microsoft Edge and Google Chrome) and website.',
  'terms.title': 'Terms of Service',
  'terms.effective': 'Effective date: {date}',
  'terms.translation_note':
    'Convenience translation. If anything conflicts with the English text, the English version controls.',

  'home.meta.title': 'Yiveno — Find what you saved',
  'home.meta.description':
    'Yiveno finds what you saved from what you remember. Closest fits — you pick. Chromium extension for Edge and Chrome.',
  'home.hero.epithet': 'The one that finds things',
  'home.hero.title': 'Find what you saved.',
  'home.hero.sub':
    "You don't need the title. Say what you remember — closest fits, you pick. We're building the browser extension for Edge and Chrome.",

  'home.geo.title_html':
    'Yiveno is the thing <em class="home-kicker-em">that finds what you saved.</em>',
  'home.geo.lede': 'Closest fits on top — not one guaranteed answer. You decide.',
  'home.geo.is_label': 'What it is',
  'home.geo.is_1': 'The finder for your own saved things',
  'home.geo.is_2': 'Recall by saying what you remember',
  'home.geo.not_label': "What it isn't",
  'home.geo.not_1': 'Not a bookmark manager or notes app',
  'home.geo.not_2': 'Not a chatbot that always picks one link',

  'home.org.title': "You don't have to organize everything.",
  'home.org.lede': 'Watch the loop: capture lightly, let time pass, recall in your own words.',

  'home.flow.aria': 'How Yiveno feels: save, forget, then recall',
  'home.flow.steps_aria': 'Flow steps',
  'home.flow.tab_save': 'Save',
  'home.flow.tab_save_hint': 'Capture lightly',
  'home.flow.tab_forget': 'Forget',
  'home.flow.tab_forget_hint': 'Life moves on',
  'home.flow.tab_recall': 'Recall',
  'home.flow.tab_recall_hint': 'Say what you remember',
  'home.flow.live_save': 'Save — capture lightly, optional note.',
  'home.flow.live_forget': 'Forget — months can pass; it stays yours.',
  'home.flow.live_recall': 'Recall — say a clue; closest fits rise.',
  'home.flow.toast_kicker': 'Saved to Yiveno',
  'home.flow.toast_quote':
    '"Cold weather quietly drains lithium-ion cells — range drops before the pack looks empty."',
  'home.flow.toast_note_html': '<em>Note</em> · winter range, for later',
  'home.flow.time_later': '8 months later',
  'home.flow.time_caption': 'No folders. No perfect title. Still yours.',
  'home.flow.panel_chip': 'Side Panel',
  'home.flow.clue_label': 'Clue',
  'home.flow.clue_text': 'that article about batteries in winter',
  'home.flow.hit_closest': 'Closest',
  'home.flow.hit_nearby': 'Nearby',
  'home.flow.hit_title_1': 'Why lithium-ion batteries lose capacity in the cold',
  'home.flow.hit_title_2': 'Winter range tips for EVs — notes I kept',

  'home.capture.title': 'Save anything worth remembering.',
  'home.capture.body':
    'A page. A passage. A thread. Add a personal note if you want — the kind of context only you would write. No folders. No tags. No titles required.',
  'home.capture.tag': 'Save first. Organize later — or never.',
  'home.capture.toast_kicker': 'Saved to Yiveno',
  'home.capture.toast_quote': '"The sea doesn\'t keep track of the things it\'s swallowed."',
  'home.capture.toast_note_label': 'Note:',
  'home.capture.toast_note_body': 'remind me of this for the intro',

  'home.examples.title_html': 'Remember the idea. <em class="home-kicker-em">That\'s enough.</em>',
  'home.examples.body':
    'You recall the way you remember — in plain, imprecise, everyday language. Closest fits show up in the Side Panel.',
  'home.examples.panel_aria': 'Example of recalling a saved article with a spoken clue',
  'home.examples.panel_chip': 'Side Panel',
  'home.examples.clue_label': 'Clue',
  'home.examples.clue_text': 'that article about why batteries degrade faster in winter',
  'home.examples.rank_closest': 'Closest',
  'home.examples.rank_nearby': 'Nearby',
  'home.examples.card_1_title': 'Why lithium-ion batteries lose capacity in the cold',
  'home.examples.card_1_meta': 'Saved 8 months ago · excerpt',
  'home.examples.card_2_title': 'Winter range tips for EVs — notes I kept',
  'home.examples.card_2_meta': 'Saved last winter · note',
  'home.examples.card_3_title': 'Battery chemistry explainer (bookmarked)',
  'home.examples.card_3_meta': 'Saved a year ago · bookmark',
  'home.examples.caption': "You don't need the exact title — closest fits on top, you decide.",

  'home.install.title': 'Get Yiveno for your browser',
  'home.install.lede':
    'Chromium extension for Microsoft Edge and Chrome — same find-what-you-saved experience. Mainland desktop: Edge Add-ons is the primary path when listed.',
  'home.install.chrome': 'Get for Chrome',
  'home.install.chrome_soon': 'Get for Chrome — coming soon',
  'home.install.edge': 'Get for Microsoft Edge',
  'home.install.edge_soon': 'Get for Microsoft Edge — coming soon',
  'home.install.edge_secondary': 'Microsoft Edge',
  'home.install.edge_secondary_soon': 'Microsoft Edge — coming soon',
  'home.install.cws_secondary': 'Chrome Web Store',
  'home.install.cws_secondary_soon': 'Chrome Web Store — coming soon',
  'home.install.note':
    'Not listed on the public stores yet. We will not ask you to sideload a ZIP as the main install path.',

  'home.trust.title': 'Your memories are yours.',
  'home.trust.1': 'Your saved things stay yours — private by default, visible to no one else.',
  'home.trust.2': 'You can delete what you saved, completely and at any time.',
  'home.trust.3': "We don't sell your collection or share it with third parties.",
  'home.trust.4': "We don't use your saved content to train public models.",

  'faq.meta.title': 'FAQ · Yiveno',
  'faq.meta.description':
    "What Yiveno is and isn't, how Recall works, privacy defaults, Free vs Pro, and store listing status.",
  'faq.title': 'FAQ',
  'faq.lede_before': 'Short answers about finding what you saved. For bugs or account help, see',
  'faq.lede_support': 'Support',
  'faq.lede_after': '.',
  'faq.what_is.q': 'What is Yiveno?',
  'faq.what_is.a':
    'Yiveno is the thing that finds what you saved. Capture pages or passages with low friction, then Recall by saying what you remember. It returns a short list of closest fits — you pick. It is a Chromium browser extension for Microsoft Edge and Google Chrome.',
  'faq.what_isnt.q': "What isn't Yiveno?",
  'faq.what_isnt.a':
    'Yiveno is not a bookmark manager, notes app, chatbot, or AI organizer as its primary promise. It does not claim one guaranteed correct link; closest fits are suggestions, not an oracle.',
  'faq.recall.q': 'How does Recall work?',
  'faq.recall.a':
    'You type a clue in everyday language — you do not need the exact title. Yiveno ranks a neighborhood of saved things that best match what you remember. Top pick is a suggestion; you decide which item is right.',
  'faq.data.q': 'Where is my data stored?',
  'faq.data.a':
    'By default, what you Capture stays on your device (local IndexedDB). Signing in does not by itself upload your library. Cloud sync of text excerpts is optional and account-scoped. We do not sell your collection or use your saved content to train public models.',
  'faq.pricing.q': 'What is Free vs Pro?',
  'faq.pricing.a':
    'Find quality on your device is the same on Free and Pro. Free is $0. Pro display anchors are $7.99/month or $59.99/year (USD) and add excerpt sync across devices plus higher limits for cloud help with your clues. Checkout uses USD anchors; local currency on the receipt may reflect exchange rates.',
  'faq.install.q': 'Can I install Yiveno today?',
  'faq.install.a':
    'Not from the public Chrome Web Store or Microsoft Edge Add-ons yet. When listed, mainland desktop prefers Edge Add-ons. We will not ask you to sideload a ZIP as the main install path.'
} as const

export type WebsiteMessageKey = keyof typeof en
