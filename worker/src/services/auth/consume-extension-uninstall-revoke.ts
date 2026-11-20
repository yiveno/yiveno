/**
 * 消费卸载一次性 revoke token：撤销对应 device token。
 * 供官网卸载落地页 / 扩展主动退出调用（公开接口，凭高熵 token）。
 */

import type { Env } from '../../types/env'
import { info, warn } from '../../utils/logger'
import { takeExtensionUninstallRevokeToken } from './extension-uninstall-revoke-kv'
import { revokeDeviceById } from './device-token-kv'

export type ConsumeExtensionUninstallRevokeResult =
  | { ok: true; revoked: boolean; deviceToken?: string }
  | { ok: false; error: 'invalid_token' | 'empty_token' }

/**
 * 一次性消费 token：删 KV 记录 → 按 deviceId 撤 device token。
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

  const result = await revokeDeviceById(env, record.userId, record.deviceId)
  if (!result.ok) {
    warn('[Auth] 卸载 revoke：KV 不可用', { userId: record.userId, deviceId: record.deviceId })
    return { ok: true, revoked: false }
  }

  info('[Auth] 已消费卸载 revoke token（撤 device）', {
    userId: record.userId,
    deviceId: record.deviceId,
    revoked: result.revoked,
    extensionId: record.extensionId
  })

  if (!result.revoked) {
    warn('[Auth] 卸载 revoke：device 已不存在（可能已主动退出）', {
      userId: record.userId,
      deviceId: record.deviceId
    })
    return { ok: true, revoked: false }
  }

  return { ok: true, revoked: true, deviceToken: result.deviceToken }
}
