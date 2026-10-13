/**
 * Worker API（embed / clue / enrichment）用 access token。
 * 过期前复用；临近过期则 refresh，避免 SW 长任务里拿 stale token。
 */

import { refreshAuthSession } from '@/infrastructure/auth/extension-oauth'
import { getAuthSession, setAuthSession } from '@/infrastructure/identity/auth-session-service'

const ACCESS_TOKEN_REFRESH_SKEW_SEC = 60

/** 返回可用于 Worker Bearer 的 token；未登录时 null。 */
export async function getWorkerApiAccessToken(): Promise<string | null> {
  const session = await getAuthSession()
  if (!session) {
    return null
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const stillValid =
    session.expiresAt != null && session.expiresAt > nowSec + ACCESS_TOKEN_REFRESH_SKEW_SEC
  if (stillValid) {
    return session.accessToken
  }

  const refreshed = await refreshAuthSession(session.refreshToken, {
    ...(session.email ? { email: session.email } : {}),
    ...(session.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
    ...(session.displayName ? { displayName: session.displayName } : {})
  })
  if (refreshed) {
    await setAuthSession(refreshed)
    return refreshed.accessToken
  }

  // refresh 失败仍尝试旧 token（由 Worker 返回 401）
  return session.accessToken
}
