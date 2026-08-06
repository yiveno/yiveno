/**
 * Gumroad Subscribers API（对账）
 */

import { error as logErrorMessage } from '../../utils/logger'

export type GumroadSubscriber = {
  id: string
  status: string
  email?: string
  cancelled_at?: string | null
  ended_at?: string | null
  failed_at?: string | null
}

export type FetchSubscriberResult =
  | { ok: true; subscriber: GumroadSubscriber }
  | { ok: false; reason: 'not_found' | 'api_error' | 'not_configured'; detail?: string }

/**
 * GET https://api.gumroad.com/v2/subscribers/:id
 * @see https://gumroad.com/api#subscribers
 */
export async function fetchGumroadSubscriber(
  accessToken: string | undefined,
  subscriberId: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchSubscriberResult> {
  const token = (accessToken || '').trim()
  if (!token) {
    return { ok: false, reason: 'not_configured' }
  }

  const id = encodeURIComponent(subscriberId.trim())
  const url = `https://api.gumroad.com/v2/subscribers/${id}?access_token=${encodeURIComponent(token)}`

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })

    if (res.status === 404) {
      return { ok: false, reason: 'not_found' }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      logErrorMessage('[Gumroad] 拉取 subscriber 失败', {
        status: res.status,
        detail: body.slice(0, 200)
      })
      return { ok: false, reason: 'api_error', detail: `http_${res.status}` }
    }

    const json = (await res.json()) as {
      success?: boolean
      subscriber?: GumroadSubscriber
    }

    if (!json.success || !json.subscriber?.id) {
      return { ok: false, reason: 'not_found' }
    }

    return { ok: true, subscriber: json.subscriber }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Gumroad] 拉取 subscriber 异常', { detail })
    return { ok: false, reason: 'api_error', detail }
  }
}

/** Gumroad 认为仍有效的订阅状态（仅 alive 授 Pro） */
export function isGumroadSubscriberAlive(status: string | null | undefined): boolean {
  return (status || '').trim().toLowerCase() === 'alive'
}
