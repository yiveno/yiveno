/**
 * Dodo Payments REST 客户端。
 * @see https://docs.dodopayments.com
 */

import type { Env } from '../../types/env'
import { error as logErrorMessage, info } from '../../utils/logger'

export type DodoSubscriptionSnapshot = {
  id: string
  status: string
  customerId: string | null
  productId: string | null
  paymentId: string | null
  customUserId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  cancelledAt: string | null
}

export type FetchDodoSubscriptionResult =
  | { ok: true; subscription: DodoSubscriptionSnapshot }
  | { ok: false; reason: 'not_found' | 'api_error' | 'not_configured'; detail?: string }

export type CreateDodoCheckoutResult =
  | { ok: true; checkoutUrl: string; sessionId: string }
  | { ok: false; reason: 'not_configured' | 'api_error'; detail?: string }

export type CreateDodoPortalResult =
  | { ok: true; portalUrl: string }
  | { ok: false; reason: 'not_configured' | 'api_error' | 'not_found'; detail?: string }

/** live_mode 才打正式 API；其余一律 test，避免漏配打到 live。 */
export function dodoEnvironment(env: Env): 'test_mode' | 'live_mode' {
  return (env.DODO_PAYMENTS_ENVIRONMENT || '').trim() === 'live_mode' ? 'live_mode' : 'test_mode'
}

function dodoApiBase(env: Env): string {
  return dodoEnvironment(env) === 'live_mode'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com'
}

function apiKey(env: Env): string {
  return (env.DODO_PAYMENTS_API_KEY || '').trim()
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

function readBool(record: Record<string, unknown> | null, key: string): boolean {
  return record?.[key] === true
}

export function extractYivenoUserIdFromMetadata(metadata: unknown): string | null {
  const record = asRecord(metadata)
  return readString(record, 'yiveno_user_id')
}

function readCustomerId(data: Record<string, unknown>): string | null {
  return readString(asRecord(data.customer), 'customer_id') || readString(data, 'customer_id')
}

/**
 * 将 Dodo subscription JSON（webhook data 或 GET 响应）归一化。
 */
export function mapDodoSubscriptionEntity(raw: unknown): DodoSubscriptionSnapshot | null {
  const data = asRecord(raw)
  if (!data) return null
  const id = readString(data, 'subscription_id') || readString(data, 'id')
  const status = readString(data, 'status')
  if (!id || !status) return null

  return {
    id,
    status,
    customerId: readCustomerId(data),
    productId: readString(data, 'product_id'),
    paymentId: readString(data, 'payment_id'),
    customUserId: extractYivenoUserIdFromMetadata(data.metadata),
    currentPeriodStart: readString(data, 'previous_billing_date') || readString(data, 'created_at'),
    currentPeriodEnd: readString(data, 'next_billing_date') || readString(data, 'expires_at'),
    cancelAtPeriodEnd: readBool(data, 'cancel_at_next_billing_date'),
    cancelledAt: readString(data, 'cancelled_at')
  }
}

async function dodoFetch(
  env: Env,
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const key = apiKey(env)
  const res = await fetch(`${dodoApiBase(env)}${path}`, {
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
 * 创建 Checkout Session，返回 hosted checkout_url。
 */
export async function createDodoCheckout(
  env: Env,
  input: { userId: string; productId: string; email?: string | null; returnUrl: string }
): Promise<CreateDodoCheckoutResult> {
  if (!apiKey(env)) {
    return { ok: false, reason: 'not_configured' }
  }

  info('[Billing] 创建 Dodo checkout', { userId: input.userId })

  const body: Record<string, unknown> = {
    product_cart: [{ product_id: input.productId, quantity: 1 }],
    metadata: { yiveno_user_id: input.userId },
    return_url: input.returnUrl
  }
  if (input.email?.trim()) {
    body.customer = { email: input.email.trim() }
  }

  try {
    const res = await dodoFetch(env, '/checkouts', {
      method: 'POST',
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      logErrorMessage('[Billing] 创建 Dodo checkout 失败', {
        status: res.status,
        detail: res.text.slice(0, 200)
      })
      return { ok: false, reason: 'api_error', detail: `http_${res.status}` }
    }
    const data = asRecord(res.json)
    const checkoutUrl = readString(data, 'checkout_url')
    const sessionId = readString(data, 'session_id')
    if (!checkoutUrl || !sessionId) {
      return { ok: false, reason: 'api_error', detail: 'missing_checkout_url' }
    }
    info('[Billing] Dodo checkout 已创建', { userId: input.userId, sessionId })
    return { ok: true, checkoutUrl, sessionId }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 创建 Dodo checkout 异常', { detail })
    return { ok: false, reason: 'api_error', detail }
  }
}

/**
 * GET /subscriptions/{id}
 */
export async function fetchDodoSubscription(
  env: Env,
  subscriptionId: string
): Promise<FetchDodoSubscriptionResult> {
  if (!apiKey(env)) {
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const res = await dodoFetch(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'GET'
    })
    if (res.status === 404) {
      return { ok: false, reason: 'not_found' }
    }
    if (!res.ok) {
      logErrorMessage('[Billing] 拉取 Dodo subscription 失败', {
        status: res.status,
        detail: res.text.slice(0, 200)
      })
      return { ok: false, reason: 'api_error', detail: `http_${res.status}` }
    }
    const mapped = mapDodoSubscriptionEntity(res.json)
    if (!mapped) {
      return { ok: false, reason: 'not_found' }
    }
    return { ok: true, subscription: mapped }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 拉取 Dodo subscription 异常', { detail })
    return { ok: false, reason: 'api_error', detail }
  }
}

/**
 * 为已有 customer 创建 Customer Portal session。
 */
export async function createDodoPortalSession(
  env: Env,
  customerId: string,
  returnUrl?: string
): Promise<CreateDodoPortalResult> {
  if (!apiKey(env)) {
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const body: Record<string, unknown> = {}
    if (returnUrl) body.return_url = returnUrl
    const res = await dodoFetch(
      env,
      `/customers/${encodeURIComponent(customerId)}/customer-portal/session`,
      { method: 'POST', body: JSON.stringify(body) }
    )
    if (res.status === 404) {
      return { ok: false, reason: 'not_found' }
    }
    if (!res.ok) {
      logErrorMessage('[Billing] 创建 Dodo portal 失败', {
        status: res.status,
        detail: res.text.slice(0, 200)
      })
      return { ok: false, reason: 'api_error', detail: `http_${res.status}` }
    }
    const data = asRecord(res.json)
    const portalUrl = readString(data, 'link') || readString(data, 'url')
    if (!portalUrl) {
      return { ok: false, reason: 'api_error', detail: 'missing_portal_url' }
    }
    return { ok: true, portalUrl }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Billing] 创建 Dodo portal 异常', { detail })
    return { ok: false, reason: 'api_error', detail }
  }
}
