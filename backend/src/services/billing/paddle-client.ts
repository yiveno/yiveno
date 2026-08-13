/**
 * Paddle Billing REST 客户端（非 Classic）。
 * @see https://developer.paddle.com/api-reference
 */

import type { Env } from '../../types/env'
import { error as logErrorMessage, info } from '../../utils/logger'

export type PaddleSubscriptionSnapshot = {
  id: string
  status: string
  customerId: string | null
  priceId: string | null
  transactionId: string | null
  customUserId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  scheduledChangeEffectiveAt: string | null
}

export type FetchPaddleSubscriptionResult =
  | { ok: true; subscription: PaddleSubscriptionSnapshot }
  | { ok: false; reason: 'not_found' | 'api_error' | 'not_configured'; detail?: string }

export type CreatePaddleCheckoutResult =
  | { ok: true; checkoutUrl: string; transactionId: string }
  | { ok: false; reason: 'not_configured' | 'api_error'; detail?: string }

export type CreatePaddlePortalResult =
  | { ok: true; portalUrl: string }
  | { ok: false; reason: 'not_configured' | 'api_error' | 'not_found'; detail?: string }

function paddleApiBase(env: Env): string {
  return (env.PADDLE_ENV || '').trim().toLowerCase() === 'sandbox'
    ? 'https://sandbox-api.paddle.com'
    : 'https://api.paddle.com'
}

function apiKey(env: Env): string {
  return (env.PADDLE_API_KEY || '').trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function extractCustomUserId(customData: unknown): string | null {
  const record = asRecord(customData)
  return readString(record, 'yiveno_user_id')
}

export function mapPaddleSubscriptionEntity(raw: unknown): PaddleSubscriptionSnapshot | null {
  const data = asRecord(raw)
  if (!data) return null
  const id = readString(data, 'id')
  const status = readString(data, 'status')
  if (!id || !status) return null

  const period = asRecord(data.current_billing_period)
  const scheduled = asRecord(data.scheduled_change)
  const items = Array.isArray(data.items) ? data.items : []
  const firstItem = items.length > 0 ? asRecord(items[0]) : null
  const price = asRecord(firstItem?.price)

  return {
    id,
    status,
    customerId: readString(data, 'customer_id'),
    priceId: readString(price, 'id'),
    transactionId: readString(data, 'transaction_id'),
    customUserId: extractCustomUserId(data.custom_data),
    currentPeriodStart: readString(period, 'starts_at'),
    currentPeriodEnd: readString(period, 'ends_at'),
    cancelAtPeriodEnd: readString(scheduled, 'action') === 'cancel',
    scheduledChangeEffectiveAt: readString(scheduled, 'effective_at')
  }
}

async function paddleFetch(
  env: Env,
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const key = apiKey(env)
  const res = await fetch(`${paddleApiBase(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })
  const text = await res.text().catch(() => '')
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, json, text }
}

/**
 * 创建自动收款 transaction，返回 checkout.url。
 * @see https://developer.paddle.com/api-reference/transactions/create-transaction
 */
export async function createPaddleCheckout(
  env: Env,
  input: { userId: string; priceId: string; email?: string | null }
): Promise<CreatePaddleCheckoutResult> {
  if (!apiKey(env)) {
    return { ok: false, reason: 'not_configured' }
  }

  info('[Billing] 创建 Paddle checkout', { userId: input.userId })

  const body: Record<string, unknown> = {
    items: [{ price_id: input.priceId, quantity: 1 }],
    custom_data: { yiveno_user_id: input.userId }
  }
  if (input.email?.trim()) {
    body.customer = { email: input.email.trim() }
  }

  try {
    const res = await paddleFetch(env, '/transactions', {
      method: 'POST',
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      logErrorMessage('[Billing] 创建 Paddle transaction 失败', {
        status: res.status,
        detail: res.text.slice(0, 200)
      })
      return { ok: false, reason: 'api_error', detail: `http_${res.status}` }
    }
    const root = asRecord(res.json)
    const data = asRecord(root?.data)
    const checkout = asRecord(data?.checkout)
    const checkoutUrl = readString(checkout, 'url')
    const transactionId = readString(data, 'id')
    if (!checkoutUrl || !transactionId) {
      return { ok: false, reason: 'api_error', detail: 'missing_checkout_url' }
    }
    info('[Billing] Paddle checkout 已创建', { userId: input.userId, transactionId })
    return { ok: true, checkoutUrl, transactionId }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 创建 Paddle checkout 异常', { detail })
    return { ok: false, reason: 'api_error', detail }
  }
}

/**
 * GET /subscriptions/{id}
 * @see https://developer.paddle.com/api-reference/subscriptions/get-subscription
 */
export async function fetchPaddleSubscription(
  env: Env,
  subscriptionId: string
): Promise<FetchPaddleSubscriptionResult> {
  if (!apiKey(env)) {
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const res = await paddleFetch(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'GET'
    })
    if (res.status === 404) {
      return { ok: false, reason: 'not_found' }
    }
    if (!res.ok) {
      logErrorMessage('[Billing] 拉取 Paddle subscription 失败', {
        status: res.status,
        detail: res.text.slice(0, 200)
      })
      return { ok: false, reason: 'api_error', detail: `http_${res.status}` }
    }
    const root = asRecord(res.json)
    const mapped = mapPaddleSubscriptionEntity(root?.data)
    if (!mapped) {
      return { ok: false, reason: 'not_found' }
    }
    return { ok: true, subscription: mapped }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 拉取 Paddle subscription 异常', { detail })
    return { ok: false, reason: 'api_error', detail }
  }
}

/**
 * 为已有 customer 创建 Customer Portal session。
 * @see https://developer.paddle.com/api-reference/customer-portals
 */
export async function createPaddlePortalSession(
  env: Env,
  customerId: string
): Promise<CreatePaddlePortalResult> {
  if (!apiKey(env)) {
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const res = await paddleFetch(
      env,
      `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
      { method: 'POST', body: JSON.stringify({}) }
    )
    if (res.status === 404) {
      return { ok: false, reason: 'not_found' }
    }
    if (!res.ok) {
      logErrorMessage('[Billing] 创建 Paddle portal 失败', {
        status: res.status,
        detail: res.text.slice(0, 200)
      })
      return { ok: false, reason: 'api_error', detail: `http_${res.status}` }
    }
    const root = asRecord(res.json)
    const data = asRecord(root?.data)
    const urls = asRecord(data?.urls)
    const general = asRecord(urls?.general)
    const portalUrl = readString(general, 'overview') || readString(data, 'url')
    if (!portalUrl) {
      return { ok: false, reason: 'api_error', detail: 'missing_portal_url' }
    }
    return { ok: true, portalUrl }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 创建 Paddle portal 异常', { detail })
    return { ok: false, reason: 'api_error', detail }
  }
}
