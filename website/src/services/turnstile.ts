/**
 * Cloudflare Turnstile（官网 Email OTP 防刷）。
 * Sitekey 走 `PUBLIC_TURNSTILE_SITE_KEY`；Secret 只配在 Supabase Attack Protection，永不进官网 bundle。
 *
 * 展示：`appearance: interaction-only` — 多数访客静默过关、不露出 Cloudflare Success 条；
 * 仅高风险才弹出可点挑战。对用户无产品信息价值，故默认不占版面。
 */

declare global {
  interface Window {
    turnstile?: TurnstileApi
    onYivenoTurnstileLoad?: () => void
  }
}

type TurnstileApi = {
  render: (
    container: string | HTMLElement,
    params: {
      sitekey: string
      callback?: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      theme?: 'light' | 'dark' | 'auto'
      appearance?: 'always' | 'execute' | 'interaction-only'
    }
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
  getResponse: (widgetId?: string) => string | undefined
}

const SCRIPT_ID = 'cf-turnstile-api'
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onYivenoTurnstileLoad'

export function getTurnstileSiteKey(): string {
  return (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '').trim()
}

export function isTurnstileConfigured(): boolean {
  return getTurnstileSiteKey().length > 0
}

let scriptPromise: Promise<TurnstileApi> | null = null

/** 加载 Turnstile 脚本（幂等）。 */
export function loadTurnstileApi(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile is browser-only.'))
  }
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    if (existing && window.turnstile) {
      resolve(window.turnstile)
      return
    }

    const prev = window.onYivenoTurnstileLoad
    window.onYivenoTurnstileLoad = () => {
      prev?.()
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile loaded without API.'))
    }

    if (!existing) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Failed to load Turnstile. Check network or try Google / Microsoft.'))
      }
      document.head.appendChild(script)
    }
  })

  return scriptPromise
}

export type TurnstileRenderHandle = {
  widgetId: string
  reset: () => void
  remove: () => void
}

/**
 * 在容器内渲染 managed 部件；token 经 onToken 回调。
 * 调用方须在发 OTP 成功/失败后 `reset()`，以便重发拿到新 token。
 */
export async function renderTurnstile(
  container: HTMLElement,
  onToken: (token: string | null) => void
): Promise<TurnstileRenderHandle> {
  const sitekey = getTurnstileSiteKey()
  if (!sitekey) {
    throw new Error('Turnstile site key is not configured.')
  }
  const api = await loadTurnstileApi()
  container.replaceChildren()
  const widgetId = api.render(container, {
    sitekey,
    theme: 'light',
    // 托管模式下：无交互需求时不渲染可见部件（避免 Success! / 品牌条抢版面）
    appearance: 'interaction-only',
    callback: token => onToken(token),
    'expired-callback': () => onToken(null),
    'error-callback': () => onToken(null)
  })
  return {
    widgetId,
    reset: () => {
      onToken(null)
      api.reset(widgetId)
    },
    remove: () => {
      onToken(null)
      try {
        api.remove(widgetId)
      } catch {
        // 组件卸载时 API 可能已不可用
      }
    }
  }
}
