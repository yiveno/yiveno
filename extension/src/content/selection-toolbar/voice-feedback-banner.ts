/**
 * 语音快捷键页内反馈横幅（Shadow DOM）。
 * 挂在划词 content script 同通道；不抢焦点；重复触发替换旧横幅。
 */

import brandCss from '@yiveno/design-tokens/css/brand.css?raw'
import semanticColorsCss from '@yiveno/design-tokens/css/semantic-colors.css?raw'

import { scopeDesignTokensToShadowHost } from '@/content/selection-toolbar/selection-toolbar-shadow-styles'

export const VOICE_FEEDBACK_HOST_ID = 'yiveno-voice-feedback-host' as const

/** 自动消失时长（毫秒）。 */
export const VOICE_FEEDBACK_AUTO_DISMISS_MS = 6_000

const BANNER_COMPONENT_CSS = `
  :host {
    all: initial;
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .banner {
    pointer-events: auto;
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
    box-sizing: border-box;
    max-width: min(420px, calc(100vw - 32px));
    padding: 10px 10px 10px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    box-shadow: var(--shadow-ink-sm);
    color: var(--sage-dark);
  }
  .banner__body {
    display: grid;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
  }
  .banner__title {
    margin: 0;
    font: 600 13px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: var(--sage-dark);
  }
  .banner__message {
    margin: 0;
    font: 500 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: var(--text-secondary, var(--sage-dark));
  }
  .banner__dismiss {
    flex-shrink: 0;
    margin: 0;
    padding: 4px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--sage-dark);
    cursor: pointer;
    font: 600 16px/1 ui-sans-serif, system-ui, sans-serif;
  }
  .banner__dismiss:hover {
    background: var(--yiveno-primary-alpha-10);
  }
`

let activeHost: HTMLElement | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null

/** 组装 Shadow 内样式（token + 组件）。 */
export function getVoiceFeedbackBannerStyles(): string {
  return [
    scopeDesignTokensToShadowHost(brandCss),
    scopeDesignTokensToShadowHost(semanticColorsCss),
    BANNER_COMPONENT_CSS
  ].join('\n')
}

function clearDismissTimer(): void {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

/** 拆除当前横幅（若有）。 */
export function dismissVoiceFeedbackBanner(): void {
  clearDismissTimer()
  activeHost?.remove()
  activeHost = null
}

/**
 * 在页面顶部居中展示语音反馈横幅。
 * 重复调用会先拆旧再挂新；不 focus 任何控件。
 */
export function showVoiceFeedbackBanner(input: {
  message: string
  dismissLabel: string
  title?: string
  autoDismissMs?: number
  doc?: Document
}): void {
  const doc = input.doc ?? document
  dismissVoiceFeedbackBanner()

  const host = doc.createElement('div')
  host.id = VOICE_FEEDBACK_HOST_ID
  // host 本身不接事件，避免挡页面；仅 banner 本体 pointer-events: auto
  host.style.pointerEvents = 'none'
  host.style.position = 'fixed'
  host.style.top = '16px'
  host.style.left = '50%'
  host.style.transform = 'translateX(-50%)'
  host.style.zIndex = '2147483647'
  const shadow = host.attachShadow({ mode: 'open' })

  const style = doc.createElement('style')
  style.textContent = getVoiceFeedbackBannerStyles()

  const banner = doc.createElement('div')
  banner.className = 'banner'
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')
  banner.style.pointerEvents = 'auto'

  const body = doc.createElement('div')
  body.className = 'banner__body'

  if (input.title?.trim()) {
    const titleEl = doc.createElement('p')
    titleEl.className = 'banner__title'
    titleEl.textContent = input.title.trim()
    body.appendChild(titleEl)
  }

  const messageEl = doc.createElement('p')
  messageEl.className = 'banner__message'
  messageEl.textContent = input.message
  body.appendChild(messageEl)

  const dismissBtn = doc.createElement('button')
  dismissBtn.type = 'button'
  dismissBtn.className = 'banner__dismiss'
  dismissBtn.setAttribute('aria-label', input.dismissLabel)
  dismissBtn.textContent = '×'
  dismissBtn.addEventListener('click', () => {
    dismissVoiceFeedbackBanner()
  })

  banner.append(body, dismissBtn)
  shadow.append(style, banner)
  doc.documentElement.appendChild(host)
  activeHost = host

  const ms = input.autoDismissMs ?? VOICE_FEEDBACK_AUTO_DISMISS_MS
  dismissTimer = setTimeout(() => {
    dismissVoiceFeedbackBanner()
  }, ms)
}

/** 仅测试：当前是否仍挂着横幅 host。 */
export function isVoiceFeedbackBannerMounted(doc: Document = document): boolean {
  return Boolean(doc.getElementById(VOICE_FEEDBACK_HOST_ID)) || activeHost?.isConnected === true
}
