/**
 * 解析官网 localStorage 中的 Supabase session，供 auth-sync 使用
 */

export interface AuthSyncSessionPayload {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  token_type?: string
  user?: unknown
}

/**
 * 从官网 localStorage 原始 JSON 解析可同步的 session
 */
export function parseWebsiteAuthStorage(rawJson: string): AuthSyncSessionPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const record = parsed as Record<string, unknown>
  const candidate =
    typeof record.access_token === 'string' && typeof record.refresh_token === 'string'
      ? record
      : record.currentSession && typeof record.currentSession === 'object'
        ? (record.currentSession as Record<string, unknown>)
        : null

  if (!candidate) {
    return null
  }

  if (typeof candidate.access_token !== 'string' || typeof candidate.refresh_token !== 'string') {
    return null
  }

  const payload: AuthSyncSessionPayload = {
    access_token: candidate.access_token,
    refresh_token: candidate.refresh_token
  }
  if (typeof candidate.expires_at === 'number') {
    payload.expires_at = candidate.expires_at
  }
  if (typeof candidate.expires_in === 'number') {
    payload.expires_in = candidate.expires_in
  }
  if (typeof candidate.token_type === 'string') {
    payload.token_type = candidate.token_type
  }
  if (candidate.user !== undefined) {
    payload.user = candidate.user
  }
  return payload
}
