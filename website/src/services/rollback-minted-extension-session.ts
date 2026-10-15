/**
 * mint 成功但 handoff 失败时：用本次下发的 uninstallRevokeToken 销会话并清 KV 租约。
 * 防止「本机未登录、远端活租约」反复 409。
 */

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(
  /\/$/,
  ''
)

/**
 * 消费 mint 响应里的一次性 revoke token（与卸载落地页同一 Worker 接口）。
 * @returns 是否 HTTP 成功（失败仅打日志，不抛）
 */
export async function rollbackMintedExtensionSession(token: string | undefined): Promise<boolean> {
  const trimmed = typeof token === 'string' ? token.trim() : ''
  if (!trimmed) {
    console.warn('[ExtensionHandoff] handoff 失败且无 revoke token，无法回滚租约')
    return false
  }
  try {
    const res = await fetch(`${API_BASE}/api/auth/extension-uninstall-revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: trimmed })
    })
    if (!res.ok) {
      console.warn('[ExtensionHandoff] 回滚租约 HTTP 非成功', { status: res.status })
      return false
    }
    console.warn('[ExtensionHandoff] 已回滚未 handoff 的扩展会话租约')
    return true
  } catch (error) {
    console.warn('[ExtensionHandoff] 回滚租约请求失败', error)
    return false
  }
}
