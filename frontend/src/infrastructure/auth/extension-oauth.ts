import type { AuthSession } from '@/core/identity/auth-session'
import {
  extractAvatarUrlFromUserMetadata,
  extractDisplayNameFromUserMetadata
} from '@/core/identity/auth-user-profile'
import { createExtensionSupabaseClient } from '@/infrastructure/auth/supabase-client'

type SupabaseAuthSessionLike = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: {
    id: string
    email?: string | null
    user_metadata?: Record<string, unknown> | null
  }
}

/**
 * 将 Supabase session 映射为扩展 AuthSession（含头像 / 展示名）。
 * previous 用于 refresh 时保留 metadata 未带回的字段，避免冲掉头像。
 */
export function mapSupabaseSessionToAuthSession(
  session: SupabaseAuthSessionLike,
  previous?: Pick<AuthSession, 'avatarUrl' | 'displayName' | 'email'> | null
): AuthSession {
  const metadata = session.user.user_metadata ?? undefined
  const avatarUrl = extractAvatarUrlFromUserMetadata(metadata) ?? previous?.avatarUrl
  const displayName = extractDisplayNameFromUserMetadata(metadata) ?? previous?.displayName
  const email = session.user.email?.trim() || previous?.email

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: session.user.id,
    ...(session.expires_at != null ? { expiresAt: session.expires_at } : {}),
    ...(email ? { email } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(displayName ? { displayName } : {})
  }
}

/**
 * 从 OAuth 回调 URL 解析 access/refresh token。
 * Supabase 通常放在 hash；兼容 query（单测与遗留回调兼容）。
 */
export function parseOAuthRedirectTokens(redirectUrl: string): {
  accessToken: string
  refreshToken: string
} | null {
  const url = new URL(redirectUrl)
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const accessToken = hashParams.get('access_token') ?? url.searchParams.get('access_token') ?? ''
  const refreshToken =
    hashParams.get('refresh_token') ?? url.searchParams.get('refresh_token') ?? ''
  if (!accessToken || !refreshToken) {
    return null
  }
  return { accessToken, refreshToken }
}

/**
 * 使用 refresh_token 刷新会话；失败返回 null。
 * previous 保留旧头像/展示名，避免 refresh 响应缺 metadata 时被冲掉。
 */
export async function refreshAuthSession(
  refreshToken: string,
  previous?: Pick<AuthSession, 'avatarUrl' | 'displayName' | 'email'> | null
): Promise<AuthSession | null> {
  const supabase = createExtensionSupabaseClient()
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session?.user?.id) {
    return null
  }

  return mapSupabaseSessionToAuthSession(data.session, previous)
}
