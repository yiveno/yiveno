/**
 * 扩展侧「单活跃会话」租约（AI_USAGE_KV）。
 * Supabase Admin 不提供「列出会话」API；用 KV 记录上次 mint 的 session_id，
 * 供挤掉前探测与定向撤销。
 */

import type { Env } from '../../types/env'
import { warn } from '../../utils/logger'

const KEY_PREFIX = 'ext_auth_session:' as const

/** KV 中一条扩展会话租约 */
export type ExtensionSessionLease = {
  /** JWT `session_id` claim */
  sessionId: string
  /** ISO 铸造时间 */
  mintedAt: string
  /** Chrome 扩展包 id（元数据；互斥不看此字段，仍须 confirmDisplace） */
  extensionId?: string
  /** 对应该活跃会话的卸载 revoke token（换发时作废） */
  uninstallRevokeToken?: string
}

export function extensionSessionLeaseKvKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

function parseLease(raw: string | null): ExtensionSessionLease | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ExtensionSessionLease).sessionId !== 'string' ||
      !(parsed as ExtensionSessionLease).sessionId.trim() ||
      typeof (parsed as ExtensionSessionLease).mintedAt !== 'string'
    ) {
      return null
    }
    const extensionId =
      typeof (parsed as ExtensionSessionLease).extensionId === 'string' &&
      (parsed as ExtensionSessionLease).extensionId!.trim()
        ? (parsed as ExtensionSessionLease).extensionId!.trim()
        : undefined
    const uninstallRevokeToken =
      typeof (parsed as ExtensionSessionLease).uninstallRevokeToken === 'string' &&
      (parsed as ExtensionSessionLease).uninstallRevokeToken!.trim()
        ? (parsed as ExtensionSessionLease).uninstallRevokeToken!.trim()
        : undefined
    return {
      sessionId: (parsed as ExtensionSessionLease).sessionId.trim(),
      mintedAt: (parsed as ExtensionSessionLease).mintedAt,
      ...(extensionId ? { extensionId } : {}),
      ...(uninstallRevokeToken ? { uninstallRevokeToken } : {})
    }
  } catch {
    return null
  }
}

/** 读取该账号当前登记的扩展会话租约；无 KV / 坏数据视为未知（不弹确认）。 */
export async function getExtensionSessionLease(
  env: Env,
  userId: string
): Promise<ExtensionSessionLease | null> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return null
  }
  try {
    return parseLease(await kv.get(extensionSessionLeaseKvKey(userId)))
  } catch {
    warn('[Auth] 读扩展会话租约失败', { userId })
    return null
  }
}

/** 写入扩展会话租约（mint 成功后）。 */
export async function putExtensionSessionLease(
  env: Env,
  userId: string,
  lease: ExtensionSessionLease
): Promise<{ ok: true } | { ok: false; error: 'kv_unavailable' }> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { ok: false, error: 'kv_unavailable' }
  }
  await kv.put(extensionSessionLeaseKvKey(userId), JSON.stringify(lease))
  return { ok: true }
}

/** 清除租约（账号删除等）。 */
export async function clearExtensionSessionLease(env: Env, userId: string): Promise<void> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return
  }
  await kv.delete(extensionSessionLeaseKvKey(userId))
}
