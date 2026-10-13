/**
 * 从 access token payload 读取 `session_id`（不验签；仅用于刚铸造的 token）。
 */

/**
 * @returns session UUID 或 null
 */
export function readJwtSessionId(accessToken: string): string | null {
  const parts = accessToken.split('.')
  if (parts.length < 2 || !parts[1]) {
    return null
  }
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = atob(b64 + pad)
    const payload = JSON.parse(json) as { session_id?: unknown }
    return typeof payload.session_id === 'string' && payload.session_id.trim()
      ? payload.session_id.trim()
      : null
  } catch {
    return null
  }
}
