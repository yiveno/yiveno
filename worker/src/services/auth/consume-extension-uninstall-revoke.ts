/**
 * 消费卸载一次性 revoke token：撤销扩展 Auth session + 清单活跃租约。
 * 供官网卸载落地页 / 扩展主动退出调用（公开接口，凭高熵 token）。
 */

import type { Env } from '../../types/env'
import { info, warn } from '../../utils/logger'
import { clearExtensionSessionLease, getExtensionSessionLease } from './extension-session-lease-kv'
import { takeExtensionUninstallRevokeToken } from './extension-uninstall-revoke-kv'
import { revokeAuthSessionById } from './revoke-auth-session'

export type ConsumeExtensionUninstallRevokeResult =
  | { ok: true; revoked: boolean; clearedLease: boolean }
  | { ok: false; error: 'invalid_token' | 'empty_token' }

/**
 * 一次性消费 token：删 KV 记录 → 撤 Auth session → 若租约仍指向该 session 则清租约。
 * token 无效 / 已用过 → invalid_token（幂等友好：重复调用同一已消费 token 亦 404）。
 */
export async function consumeExtensionUninstallRevoke(
  env: Env,
  rawToken: string
): Promise<ConsumeExtensionUninstallRevokeResult> {
  const token = rawToken.trim()
  if (!token) {
    return { ok: false, error: 'empty_token' }
  }

  const record = await takeExtensionUninstallRevokeToken(env, token)
  if (!record) {
    return { ok: false, error: 'invalid_token' }
  }

  const revoked = await revokeAuthSessionById(env, record.userId, record.sessionId)

  let clearedLease = false
  const lease = await getExtensionSessionLease(env, record.userId)
  if (lease && lease.sessionId === record.sessionId) {
    await clearExtensionSessionLease(env, record.userId)
    clearedLease = true
  }

  info('[Auth] 已消费卸载 revoke token', {
    userId: record.userId,
    sessionId: record.sessionId,
    revoked,
    clearedLease,
    extensionId: record.extensionId
  })

  if (!revoked) {
    warn('[Auth] 卸载 revoke：Auth session 撤销未确认成功（租约可能已清）', {
      userId: record.userId,
      sessionId: record.sessionId
    })
  }

  return { ok: true, revoked, clearedLease }
}
