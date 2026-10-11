/**
 * 探测 `auth.sessions` 中是否仍存在指定 session（用于识别 KV 僵死租约）。
 * 扩展重装 / 本机清登录不会自动删 Worker KV；若 Auth 侧 session 已不在，应放行 mint。
 */

import type { Env } from '../../types/env'
import { warn, toLogError } from '../../utils/logger'

function serviceHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Profile': 'auth',
    Accept: 'application/json'
  }
}

export type AuthSessionExistsResult =
  { status: 'exists' } | { status: 'missing' } | { status: 'unknown' } // 探测失败：保守仍要求确认

/**
 * 查询 auth.sessions 是否仍有该行。
 */
export async function authSessionExists(
  env: Env,
  userId: string,
  sessionId: string
): Promise<AuthSessionExistsResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 'unknown' }
  }
  const id = sessionId.trim()
  const uid = userId.trim()
  if (!id || !uid) {
    return { status: 'missing' }
  }

  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sessions`)
  url.searchParams.set('id', `eq.${id}`)
  url.searchParams.set('user_id', `eq.${uid}`)
  url.searchParams.set('select', 'id')
  url.searchParams.set('limit', '1')

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: serviceHeaders(env.SUPABASE_SERVICE_ROLE_KEY)
    })
    if (res.status === 404 || res.status === 406) {
      // 表/schema 不可见：无法区分僵死与存活
      warn('[Auth] 无法探测 auth.sessions（schema 可能未暴露）', {
        userId: uid,
        status: res.status
      })
      return { status: 'unknown' }
    }
    if (!res.ok) {
      warn('[Auth] 探测 auth.sessions HTTP 失败', {
        userId: uid,
        sessionId: id,
        status: res.status
      })
      return { status: 'unknown' }
    }
    const rows = (await res.json()) as unknown
    if (Array.isArray(rows) && rows.length > 0) {
      return { status: 'exists' }
    }
    return { status: 'missing' }
  } catch (err) {
    warn('[Auth] 探测 auth.sessions 异常', {
      userId: uid,
      sessionId: id,
      detail: toLogError(err)
    })
    return { status: 'unknown' }
  }
}
