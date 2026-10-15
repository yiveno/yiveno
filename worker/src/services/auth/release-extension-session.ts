/**
 * 用扩展当前 access token（Bearer）释放本会话：撤 Auth session + 若仍占租约则清 KV。
 * 供主动退出时无 uninstallRevokeToken 的兜底（旧会话 / register 失败）。
 */

import type { Env } from '../../types/env'
import { info, warn } from '../../utils/logger'
import { clearExtensionSessionLease, getExtensionSessionLease } from './extension-session-lease-kv'
import { deleteExtensionUninstallRevokeToken } from './extension-uninstall-revoke-kv'
import { readJwtSessionId } from './read-jwt-session-id'
import { revokeAuthSessionById } from './revoke-auth-session'

export type ReleaseExtensionSessionResult =
  { ok: true; revoked: boolean; clearedLease: boolean } | { ok: false; error: 'no_session_id' }

/**
 * 撤销 Bearer 对应 session；仅当 KV 租约仍指向该 session 时清租约并丢弃配套 revoke token。
 * 租约已被他端占用 → 只撤本会话，不动租约（防误清活跃端）。
 */
export async function releaseExtensionSessionByAccessToken(
  env: Env,
  userId: string,
  accessToken: string
): Promise<ReleaseExtensionSessionResult> {
  const sessionId = readJwtSessionId(accessToken)
  if (!sessionId) {
    warn('[Auth] extension-session-release：access token 无 session_id', { userId })
    return { ok: false, error: 'no_session_id' }
  }

  const revoked = await revokeAuthSessionById(env, userId, sessionId)

  let clearedLease = false
  const lease = await getExtensionSessionLease(env, userId)
  if (lease && lease.sessionId === sessionId) {
    if (lease.uninstallRevokeToken) {
      await deleteExtensionUninstallRevokeToken(env, lease.uninstallRevokeToken)
    }
    await clearExtensionSessionLease(env, userId)
    clearedLease = true
  }

  info('[Auth] 已按 Bearer 释放扩展会话', {
    userId,
    sessionId,
    revoked,
    clearedLease
  })

  if (!revoked) {
    warn('[Auth] extension-session-release：Auth session 撤销未确认', {
      userId,
      sessionId
    })
  }

  return { ok: true, revoked, clearedLease }
}
