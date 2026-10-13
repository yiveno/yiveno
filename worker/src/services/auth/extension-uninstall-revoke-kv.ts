/**
 * 扩展卸载用一次性 revoke token（AI_USAGE_KV）。
 * 卸载时扩展无法再跑代码，只能靠 setUninstallURL 打开官网页持 token 销远程会话。
 */

import type { Env } from '../../types/env'
import { warn } from '../../utils/logger'

const KEY_PREFIX = 'ext_uninstall_revoke:' as const

/**
 * Cloudflare KV `expirationTtl` 上限为 31536000（365 天）。
 * 超过会 put 失败 → mint 拿不到 token → 卸载无法销远程会话。
 */
const REVOKE_TOKEN_TTL_SEC = 60 * 60 * 24 * 365

export type ExtensionUninstallRevokeRecord = {
  userId: string
  sessionId: string
  extensionId: string | null
  createdAt: string
}

export function extensionUninstallRevokeKvKey(token: string): string {
  return `${KEY_PREFIX}${token}`
}

/** 生成高熵 revoke token（可放进 uninstall URL query）。 */
export function createExtensionUninstallRevokeToken(): string {
  return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
}

export async function putExtensionUninstallRevokeToken(
  env: Env,
  token: string,
  record: ExtensionUninstallRevokeRecord
): Promise<{ ok: true } | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' }> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { ok: false, error: 'kv_unavailable' }
  }
  try {
    await kv.put(extensionUninstallRevokeKvKey(token), JSON.stringify(record), {
      expirationTtl: REVOKE_TOKEN_TTL_SEC
    })
    return { ok: true }
  } catch {
    warn('[Auth] 写入卸载 revoke token 失败（KV put）')
    return { ok: false, error: 'kv_put_failed' }
  }
}

export async function takeExtensionUninstallRevokeToken(
  env: Env,
  token: string
): Promise<ExtensionUninstallRevokeRecord | null> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return null
  }
  const key = extensionUninstallRevokeKvKey(token.trim())
  try {
    const raw = await kv.get(key)
    if (!raw) {
      return null
    }
    await kv.delete(key)
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ExtensionUninstallRevokeRecord).userId !== 'string' ||
      typeof (parsed as ExtensionUninstallRevokeRecord).sessionId !== 'string'
    ) {
      return null
    }
    const row = parsed as ExtensionUninstallRevokeRecord
    return {
      userId: row.userId,
      sessionId: row.sessionId,
      extensionId: typeof row.extensionId === 'string' ? row.extensionId : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString()
    }
  } catch {
    warn('[Auth] 读取/消费卸载 revoke token 失败')
    return null
  }
}

/** 丢弃尚未使用的 revoke token（换发 session / 主动退出时）。 */
export async function deleteExtensionUninstallRevokeToken(
  env: Env,
  token: string | null | undefined
): Promise<void> {
  if (!token?.trim() || !env.AI_USAGE_KV) {
    return
  }
  try {
    await env.AI_USAGE_KV.delete(extensionUninstallRevokeKvKey(token.trim()))
  } catch {
    warn('[Auth] 删除卸载 revoke token 失败')
  }
}
