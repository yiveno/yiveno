/**
 * Turnstile captcha token：开官网页 `/auth/turnstile`，经 UI 桥收 `website_turnstile_token`。
 * 一次性凭证：立即消费、不持久化、日志不打 token 内容。
 */

import { getWebsiteBaseUrl } from '@/infrastructure/browser/website-page'
import { logger } from '@/infrastructure/logging/logger'

/** 等待桥消息超时（后台交互挑战用户看不到 → fail-open）。 */
const TURNSTILE_TIMEOUT_MS = 30_000

export type GetTurnstileTokenOptions = {
  /** true：前景打开 tab，供 Settings 手动完成交互式验证 */
  foreground?: boolean
}

type TurnstileWaiter = {
  resolve: (token: string | null) => void
  timer: ReturnType<typeof setTimeout>
}

let turnstileWaiter: TurnstileWaiter | null = null
let turnstileTabId: number | null = null
let inflight: Promise<string | null> | null = null
/** 后台曾失败、需前景交互时置位；避免反复开后台 tab 卡 30s。 */
let captchaRetryNeeded = false

/** Settings：是否展示「前景重试验证」入口。 */
export function isAnonymousCaptchaRetryNeeded(): boolean {
  return captchaRetryNeeded
}

/** 匿名会话建成（或已登录）后清除重试标记。 */
export function clearAnonymousCaptchaRetryNeeded(): void {
  captchaRetryNeeded = false
}

/** ensure 失败（含 captcha 后 signup/exchange 失败）时置位，供 Settings 前景重试。 */
export function markAnonymousCaptchaRetryNeeded(): void {
  captchaRetryNeeded = true
}

/** 测试用。 */
export function resetTurnstileTokenProviderForTests(): void {
  if (turnstileWaiter) {
    clearTimeout(turnstileWaiter.timer)
    turnstileWaiter = null
  }
  turnstileTabId = null
  inflight = null
  captchaRetryNeeded = false
}

/** UI 桥收到 `website_turnstile_token` 时调用；返回是否消费。 */
export function resolveTurnstileTokenFromUiBridge(token: unknown): boolean {
  if (typeof token !== 'string' || !token.trim() || !turnstileWaiter) {
    return false
  }
  const waiter = turnstileWaiter
  turnstileWaiter = null
  clearTimeout(waiter.timer)
  waiter.resolve(token.trim())
  return true
}

async function closeTurnstileTab(): Promise<void> {
  const id = turnstileTabId
  turnstileTabId = null
  if (id == null) {
    return
  }
  try {
    await chrome.tabs.remove(id)
  } catch {
    // tab 可能已关
  }
}

async function runGetTurnstileToken(options: GetTurnstileTokenOptions): Promise<string | null> {
  const foreground = options.foreground === true

  // 已判定需交互：后台路径立刻 fail-open，等 Settings 前景重试
  if (!foreground && captchaRetryNeeded) {
    logger.info('Auth', 'Turnstile：跳过后台重试（需前景验证）')
    return null
  }

  const url = new URL('/auth/turnstile', `${getWebsiteBaseUrl()}/`)
  url.searchParams.set('extension_id', chrome.runtime.id)

  try {
    const tab = await chrome.tabs.create({
      url: url.toString(),
      active: foreground
    })
    turnstileTabId = typeof tab.id === 'number' ? tab.id : null

    const token = await new Promise<string | null>(resolve => {
      const finish = (value: string | null): void => {
        if (turnstileWaiter) {
          clearTimeout(turnstileWaiter.timer)
          turnstileWaiter = null
        }
        resolve(value)
      }

      turnstileWaiter = {
        resolve: finish,
        timer: setTimeout(() => {
          logger.warn('Auth', 'Turnstile 桥超时，fail-open', {
            foreground,
            timeoutMs: TURNSTILE_TIMEOUT_MS
          })
          finish(null)
        }, TURNSTILE_TIMEOUT_MS)
      }
    })

    if (token) {
      // 不在此处清 retry 标记：token 只是 ensure 一步；会话建成才 clear
      logger.info('Auth', 'Turnstile 桥已拿到 captcha token', {
        tokenLength: token.length,
        foreground
      })
      return token
    }

    captchaRetryNeeded = true
    logger.info('Auth', 'Turnstile 桥未拿到 token', { foreground })
    return null
  } catch (error) {
    captchaRetryNeeded = true
    logger.warn('Auth', '打开 Turnstile 页失败', error)
    return null
  } finally {
    await closeTurnstileTab()
  }
}

/**
 * 取得 Turnstile captcha token。
 * @returns token；不可用时 null（调用方 fail-open，不弹错）
 */
export async function getTurnstileToken(
  options: GetTurnstileTokenOptions = {}
): Promise<string | null> {
  if (inflight) {
    return inflight
  }
  inflight = runGetTurnstileToken(options).finally(() => {
    inflight = null
  })
  return inflight
}
