/**
 * 只读 MCP 云端门禁（AI_USAGE_KV）。
 * Settings 关闭后 PUT 写入 false，/api/mcp 拒绝。
 */

import type { Env } from '../../types/env'

const KEY_PREFIX = 'mcp_read_only:' as const

export function mcpPreferenceKvKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

/** 读取云端 MCP 开关；缺 KV 或未写入视为关闭。 */
export async function getMcpReadOnlyEnabled(env: Env, userId: string): Promise<boolean> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return false
  }
  const raw = await kv.get(mcpPreferenceKvKey(userId))
  return raw === '1' || raw === 'true'
}

/** 写入云端 MCP 开关。 */
export async function putMcpReadOnlyEnabled(
  env: Env,
  userId: string,
  enabled: boolean
): Promise<{ ok: true } | { ok: false; error: 'kv_unavailable' }> {
  const kv = env.AI_USAGE_KV
  if (!kv) {
    return { ok: false, error: 'kv_unavailable' }
  }
  await kv.put(mcpPreferenceKvKey(userId), enabled ? '1' : '0')
  return { ok: true }
}
