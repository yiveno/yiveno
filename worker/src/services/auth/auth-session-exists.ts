/**
 * 探测指定 Auth session 是否仍存在于 `auth.sessions`。
 * 用于 mint 前识别「KV 租约僵死」（Auth 已无该 session，但 KV 未清）。
 *
 * **铁律（互斥优先）：**
 * - 仅当 **高置信 gone**（PostgREST 200 + 空数组）才回报 `gone` → 调用方才可清租约直 mint
 * - 探测失败 / 非预期状态 → `unknown` → 调用方 **必须** 仍弹挤掉确认
 * - **禁止**把 Admin GET 的 404 当成 gone：多数 GoTrue **没有** GET `/sessions/{id}` 路由，
 *   404 常表示「路由不存在」而非「会话已废」——误判会整段绕过扩展单活跃。
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

export type AuthSessionExistsResult =
  | { status: 'alive' } // 仍存在
  | { status: 'gone' } // 高置信已不存在（可清僵死租约）
  | { status: 'unknown' } // 探测失败：调用方保守处理（仍弹确认）

/**
 * 判断 user 名下某 session_id 是否仍在 Auth。
 * 只用 PostgREST `auth.sessions` SELECT（与 revoke 回退同源）；不依赖 Admin GET。
 */
export async function authSessionExistsById(
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
    return { status: 'unknown' }
  }

  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  const url = new URL(`${base}/rest/v1/sessions`)
  url.searchParams.set('id', `eq.${id}`)
  url.searchParams.set('user_id', `eq.${uid}`)
  url.searchParams.set('select', 'id')

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: serviceHeaders(key, {
        Accept: 'application/json',
        'Accept-Profile': 'auth',
        'Content-Profile': 'auth'
      })
    })
    if (!res.ok) {
      warn('[Auth] PostgREST 探测 session 存在性失败（保守 unknown）', {
        userId: uid,
        sessionId: id,
        status: res.status
      })
      return { status: 'unknown' }
    }
    const rows = (await res.json()) as unknown
    if (!Array.isArray(rows)) {
      warn('[Auth] PostgREST 探测 session 返回非数组（保守 unknown）', {
        userId: uid,
        sessionId: id
      })
      return { status: 'unknown' }
    }
    return rows.length > 0 ? { status: 'alive' } : { status: 'gone' }
  } catch (err) {
    warn('[Auth] PostgREST 探测 session 存在性异常（保守 unknown）', {
      userId: uid,
      sessionId: id,
      detail: toLogError(err)
    })
    return { status: 'unknown' }
  }
}
