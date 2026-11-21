/**
 * Turnstile captcha token：开官网页 `/auth/turnstile`，经 UI 桥收 `website_turnstile_token`。
 * 一次性凭证：立即消费、不持久化、日志不打 token 内容。
 *
 * 页生命周期：开前清扫 + 页面自关 + SW 启动清扫（AN4），不依赖 SW 活过整个等待。
 */

import { getWebsiteBaseUrl } from '@/infrastructure/browser/website-page'
import { logger } from '@/infrastructure/logging/logger'

/** 等待桥消息超时（后台交互挑战用户看不到 → fail-open）。 */
const TURNSTILE_TIMEOUT_MS = 30_000

/**
 * 官网 Turnstile 页 hostname（与 manifest `externally_connectable` 一致）。
 * 只比 hostname，不比 port（localhost 各开发端口均命中）。
 */
const TURNSTILE_HOSTNAMES = new Set([
  'yiveno.com',
  'www.yiveno.com',
  'yiveno.cn',
  'www.yiveno.cn',
  'localhost'
])

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

/** 是否为官网 `/auth/turnstile` 残留候选（解析失败则否）。 */
function isTurnstilePageUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) {
    return false
  }
  try {
    const parsed = new URL(rawUrl)
    return parsed.pathname === '/auth/turnstile' && TURNSTILE_HOSTNAMES.has(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * 清扫残留 Turnstile 页（AN4 层 1 / 层 3）。
 * 跳过 active 页与当前等待中的 `turnstileTabId`；不持久化 tab id；失败 fail-open。
 */
export async function closeStaleTurnstileTabs(): Promise<void> {
  let tabs: chrome.tabs.Tab[]
  try {
    tabs = await chrome.tabs.query({})
  } catch {
    return
  }

  let closed = 0
  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || !isTurnstilePageUrl(tab.url)) {
      continue
    }
    // 用户正在看的页（可能前景交互验证中）
    if (tab.active === true) {
      continue
    }
    // 读值在 remove 前一刻，避免 query↔remove 之间新开的等待 tab 被误关
    if (tab.id === turnstileTabId) {
      continue
    }
    try {
      await chrome.tabs.remove(tab.id)
      closed += 1
    } catch {
      // tab 可能已关
    }
  }

  if (closed > 0) {
    logger.info('Auth', 'Turnstile：清扫残留页', { closed })
  }
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
    // 开前清扫：single-flight 下 turnstileTabId 在上一次 finally 后已为 null
    await closeStaleTurnstileTabs()

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
