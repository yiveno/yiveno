/**
 * Worker `POST /api/auth/promote` 客户端（仅 Background）。
 * device Bearer + email → 绑邮箱转正；不重发 token。
 */

import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

/** 日志掩码邮箱（不进正文明文）。 */
export function maskEmailForLog(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0) return '***'
  return `${trimmed.slice(0, 1)}***@${trimmed.slice(at + 1) || '***'}`
}

export type PromoteAnonymousApiResult =
  | {
      ok: true
      data: { userId: string; email: string; isAnonymous: false }
    }
  | {
      ok: false
      status: number
      error: string
    }

/**
 * POST /api/auth/promote
 */
export async function promoteAnonymousViaApi(
  deviceToken: string,
  email: string
): Promise<PromoteAnonymousApiResult> {
  const startedAt = flowStart('Auth', 'promote anonymous')
  try {
    const url = `${getApiBaseUrl()}/api/auth/promote`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({ email })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `http_${response.status}`
      flowFail('Auth', 'promote anonymous', startedAt, new Error(error), {
        status: response.status,
        emailMasked: maskEmailForLog(email)
      })
      return { ok: false, status: response.status, error }
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      (body as { success?: unknown }).success !== true ||
      typeof (body as { data?: unknown }).data !== 'object' ||
      (body as { data?: unknown }).data === null
    ) {
      flowFail('Auth', 'promote anonymous', startedAt, new Error('invalid_promote_response'))
      return { ok: false, status: 500, error: 'invalid_promote_response' }
    }
    const data = (body as { data: { userId: string; email: string; isAnonymous: boolean } }).data
    if (
      typeof data.userId !== 'string' ||
      typeof data.email !== 'string' ||
      data.isAnonymous !== false
    ) {
      return { ok: false, status: 500, error: 'invalid_promote_data' }
    }
    flowOk('Auth', 'promote anonymous', startedAt, {
      userId: data.userId,
      emailMasked: maskEmailForLog(data.email)
    })
    return {
      ok: true,
      data: { userId: data.userId, email: data.email, isAnonymous: false }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'promote_network'
    flowFail('Auth', 'promote anonymous', startedAt, error)
    return { ok: false, status: 0, error: message }
  }
}
