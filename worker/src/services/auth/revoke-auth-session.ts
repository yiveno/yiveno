/**
 * 撤销指定 Supabase Auth session（等价于该端被登出：refresh 失效）。
 * 1) GoTrue Admin `DELETE …/admin/users/{id}/sessions/{session_id}`（若部署支持）
 * 2) 回退 PostgREST `Accept-Profile` + `Content-Profile: auth` 删 `auth.sessions`
 *
 * 404 / 已不存在视为成功（目标会话已废即可）。
 */

import type { Env } from '../../types/env'
import { warn, toLogError } from '../../utils/logger'

function serviceHeaders(serviceKey: string, extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra
  }
}

function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410
}

/**
 * 删除属于该 user 的一条 session。
 * @returns true 表示目标会话已不存在或已成功删除
 */
export async function revokeAuthSessionById(
  env: Env,
  userId: string,
  sessionId: string
): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return false
  }
  const id = sessionId.trim()
  const uid = userId.trim()
  if (!id || !uid) {
    return false
  }

  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const adminRes = await fetch(`${base}/auth/v1/admin/users/${uid}/sessions/${id}`, {
      method: 'DELETE',
      headers: serviceHeaders(key)
    })
    if (adminRes.ok || adminRes.status === 204 || isGoneStatus(adminRes.status)) {
      return true
    }
    // 405：旧 GoTrue 无此路由 → 试 PostgREST
    if (adminRes.status !== 405) {
      warn('[Auth] Admin 撤销 session 非预期状态', {
        userId: uid,
        sessionId: id,
        status: adminRes.status
      })
    }
  } catch (err) {
    warn('[Auth] Admin 撤销 session 异常', {
      userId: uid,
      sessionId: id,
      detail: toLogError(err)
    })
  }

  const url = new URL(`${base}/rest/v1/sessions`)
  url.searchParams.set('id', `eq.${id}`)
  url.searchParams.set('user_id', `eq.${uid}`)

  try {
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: serviceHeaders(key, {
        'Accept-Profile': 'auth',
        'Content-Profile': 'auth',
        Prefer: 'return=minimal'
      })
    })
    if (res.ok || res.status === 204 || isGoneStatus(res.status)) {
      return true
    }
    warn('[Auth] PostgREST 撤销 auth.sessions 失败', {
      userId: uid,
      sessionId: id,
      status: res.status
    })
    return false
  } catch (err) {
    warn('[Auth] PostgREST 撤销 auth.sessions 异常', {
      userId: uid,
      sessionId: id,
      detail: toLogError(err)
    })
    return false
  }
}
