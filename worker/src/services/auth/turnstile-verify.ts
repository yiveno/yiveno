/**
 * Cloudflare Turnstile siteverify（发码前 CAPTCHA）。
 * secret 缺失 fail-closed；token / 校验失败不透传原始错误。
 */

import type { Env } from '../../types/env'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileVerifyResult =
  | { ok: true }
  | {
      ok: false
      reason: 'missing_secret' | 'missing_token' | 'verify_failed' | 'network_error'
    }

/** 可注入 fetch（单测不必满足完整 `typeof fetch` / preconnect） */
export type TurnstileFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type VerifyTurnstileOpts = {
  remoteIp?: string
  fetchFn?: TurnstileFetchFn
}

/**
 * 校验 Turnstile response token。
 * POST siteverify；body 为 form：secret + response（+ remoteip）。
 */
export async function verifyTurnstileToken(
  env: Pick<Env, 'TURNSTILE_SECRET_KEY'>,
  token: string | undefined | null,
  opts: VerifyTurnstileOpts = {}
): Promise<TurnstileVerifyResult> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) {
    return { ok: false, reason: 'missing_secret' }
  }
  const trimmed = typeof token === 'string' ? token.trim() : ''
  if (!trimmed) {
    return { ok: false, reason: 'missing_token' }
  }

  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', trimmed)
  const remoteIp = opts.remoteIp?.trim()
  if (remoteIp) {
    body.set('remoteip', remoteIp)
  }

  const fetchFn = opts.fetchFn ?? fetch
  try {
    const response = await fetchFn(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    })
    let json: { success?: unknown } | null = null
    try {
      json = (await response.json()) as { success?: unknown }
    } catch {
      return { ok: false, reason: 'verify_failed' }
    }
    if (json?.success === true) {
      return { ok: true }
    }
    return { ok: false, reason: 'verify_failed' }
  } catch {
    return { ok: false, reason: 'network_error' }
  }
}
