/**
 * 官网 Paddle.js 客户端（仅 client token；禁止 API key）。
 */

import { initializePaddle, type Environments, type Paddle } from '@paddle/paddle-js'

let paddlePromise: Promise<Paddle> | null = null

function requirePaddleEnv(): Environments {
  const raw = import.meta.env.PUBLIC_PADDLE_ENV
  if (raw !== 'sandbox' && raw !== 'production') {
    throw new Error(
      '[Billing] PUBLIC_PADDLE_ENV must be set to "sandbox" or "production" (never silently defaulted)'
    )
  }
  return raw
}

function requireClientToken(): string {
  const token = (import.meta.env.PUBLIC_PADDLE_CLIENT_TOKEN || '').trim()
  if (!token) {
    throw new Error('[Billing] PUBLIC_PADDLE_CLIENT_TOKEN is not set')
  }
  return token
}

/** 解析站点绝对 success URL。 */
export function resolveWelcomeUrl(): string {
  const base = (import.meta.env.PUBLIC_WEBSITE_URL || '').replace(/\/$/, '')
  if (base) return `${base}/welcome`
  if (typeof window !== 'undefined') return `${window.location.origin}/welcome`
  throw new Error('[Billing] PUBLIC_WEBSITE_URL is not set and window is unavailable')
}

/**
 * 初始化 Paddle（单例）。环境必须来自 env，缺失即抛错。
 */
export async function getPaddle(): Promise<Paddle> {
  if (!paddlePromise) {
    paddlePromise = (async () => {
      const environment = requirePaddleEnv()
      const token = requireClientToken()
      const paddle = await initializePaddle({
        environment,
        token,
        checkout: {
          settings: {
            displayMode: 'overlay',
            variant: 'one-page',
            successUrl: resolveWelcomeUrl()
          }
        }
      })
      if (!paddle) {
        throw new Error('[Billing] initializePaddle returned undefined')
      }
      return paddle
    })()
  }
  return paddlePromise
}

/**
 * 拉取一组 Price 的本地化展示价。
 * 只使用 Paddle 返回的 formattedTotals；countryCode 缺省时不传，交给 Paddle IP 探测。
 */
export async function previewFormattedTotals(input: {
  priceIds: string[]
  countryCode?: string
}): Promise<Map<string, string>> {
  const paddle = await getPaddle()
  const params: Parameters<Paddle['PricePreview']>[0] = {
    items: input.priceIds.map(priceId => ({ priceId, quantity: 1 }))
  }
  if (input.countryCode) {
    params.address = { countryCode: input.countryCode }
  }

  const preview = await paddle.PricePreview(params)
  const map = new Map<string, string>()
  for (const line of preview.data.details.lineItems) {
    map.set(line.price.id, line.formattedTotals.total)
  }
  return map
}
