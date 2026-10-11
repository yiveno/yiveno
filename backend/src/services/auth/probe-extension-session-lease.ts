/**
 * 扩展侧探测：本 access token 的 session_id 是否仍是账号下的活跃租约。
 * 不走 Supabase refresh，避免 token 端限流挡住「被挤掉」发现。
 */

import type { Env } from '../../types/env'
import { getExtensionSessionLease } from './extension-session-lease-kv'
import { readJwtSessionId } from './read-jwt-session-id'
import { warn } from '../../utils/logger'

export type ProbeExtensionSessionLeaseResult =
  | { status: 'active' } // 租约匹配或尚无租约（降级放行）
  | { status: 'displaced' } // KV 租约是另一条 session
  | { status: 'unknown' } // 读不到 session_id / KV 异常：调用方回退 refresh

/**
 * 用已验签的 userId + access token 对照 KV 租约。
 */
export async function probeExtensionSessionLease(
  env: Env,
  userId: string,
  accessToken: string
): Promise<ProbeExtensionSessionLeaseResult> {
  const sessionId = readJwtSessionId(accessToken)
  if (!sessionId) {
    warn('[Auth] lease 探测：access token 无 session_id', { userId })
    return { status: 'unknown' }
  }

  let lease: Awaited<ReturnType<typeof getExtensionSessionLease>>
  try {
    lease = await getExtensionSessionLease(env, userId)
  } catch {
    return { status: 'unknown' }
  }

  // 无租约：旧部署 / KV 暂不可用 → 不据此踢人
  if (!lease) {
    return { status: 'active' }
  }

  if (lease.sessionId === sessionId) {
    return { status: 'active' }
  }

  return { status: 'displaced' }
}
