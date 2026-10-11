/**
 * 挤掉时：撤销该用户除保留列表外的全部 Auth session。
 * 保留 = 新扩展 session + 本次 mint 用的官网 Bearer session，避免连后者官网一起踢掉。
 */

import type { Env } from '../../types/env'
import { info, warn, toLogError } from '../../utils/logger'
import { revokeAuthSessionById } from './revoke-auth-session'

function serviceHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Profile': 'auth',
    Accept: 'application/json'
  }
}

/**
 * 列出用户当前 auth.sessions id（PostgREST）。
 * 失败返回 null（调用方降级为只撤租约那条）。
 */
async function listAuthSessionIdsForUser(env: Env, userId: string): Promise<string[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }
  const uid = userId.trim()
  if (!uid) {
    return []
  }
  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sessions`)
  url.searchParams.set('user_id', `eq.${uid}`)
  url.searchParams.set('select', 'id')

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: serviceHeaders(env.SUPABASE_SERVICE_ROLE_KEY)
    })
    if (!res.ok) {
      warn('[Auth] 列出 auth.sessions 失败', { userId: uid, status: res.status })
      return null
    }
    const rows = (await res.json()) as unknown
    if (!Array.isArray(rows)) {
      return null
    }
    const ids: string[] = []
    for (const row of rows) {
      if (
        typeof row === 'object' &&
        row !== null &&
        typeof (row as { id?: unknown }).id === 'string' &&
        (row as { id: string }).id.trim()
      ) {
        ids.push((row as { id: string }).id.trim())
      }
    }
    return ids
  } catch (err) {
    warn('[Auth] 列出 auth.sessions 异常', { userId: uid, detail: toLogError(err) })
    return null
  }
}

export type RevokeOtherAuthSessionsResult =
  | { ok: true; revokedCount: number; listed: boolean }
  | { ok: false; reason: 'list_failed' | 'revoke_failed' }

/**
 * 撤销 user 下除 keepSessionIds 以外的全部 session。
 * keep 为空时不执行（避免误杀全部）。
 */
export async function revokeOtherAuthSessions(
  env: Env,
  userId: string,
  keepSessionIds: readonly string[]
): Promise<RevokeOtherAuthSessionsResult> {
  const keep = new Set(keepSessionIds.map(id => id.trim()).filter(id => id.length > 0))
  if (keep.size === 0) {
    warn('[Auth] revokeOther：keep 为空，跳过', { userId })
    return { ok: true, revokedCount: 0, listed: false }
  }

  const listed = await listAuthSessionIdsForUser(env, userId)
  if (listed == null) {
    return { ok: false, reason: 'list_failed' }
  }

  const toRevoke = listed.filter(id => !keep.has(id))
  let revokedCount = 0
  for (const sessionId of toRevoke) {
    const ok = await revokeAuthSessionById(env, userId, sessionId)
    if (!ok) {
      warn('[Auth] revokeOther：单条撤销失败', { userId, sessionId })
      return { ok: false, reason: 'revoke_failed' }
    }
    revokedCount += 1
  }

  info('[Auth] revokeOther：已撤销其它会话', {
    userId,
    revokedCount,
    kept: keep.size,
    listed: listed.length
  })
  return { ok: true, revokedCount, listed: true }
}
