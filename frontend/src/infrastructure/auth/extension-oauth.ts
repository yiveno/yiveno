import type { AuthOAuthProvider } from '@/core/identity/auth-session'
import type { AuthSession } from '@/core/identity/auth-session'
import {
  extractAvatarUrlFromUserMetadata,
  extractDisplayNameFromUserMetadata
} from '@/core/identity/auth-user-profile'
import { createExtensionSupabaseClient } from '@/infrastructure/auth/supabase-client'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

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

/** Supabase OAuth provider 映射（microsoft → azure）。 */
function toSupabaseProvider(provider: AuthOAuthProvider): 'google' | 'azure' {
  return provider === 'microsoft' ? 'azure' : 'google'
}

/** 扩展 OAuth 回调地址（chrome.identity）。 */
export function getExtensionOAuthRedirectUrl(): string {
  return `https://${chrome.runtime.id}.chromiumapp.org/`
}

/**
 * 从 launchWebAuthFlow 返回的 URL 解析 access/refresh token。
 * Supabase 通常放在 hash；兼容 query。
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
 * 通过 chrome.identity + Supabase OAuth 登录。
 * 成功后返回可持久化的 AuthSession（调用方负责写入 storage / AccountBinding）。
 */
export async function signInWithOAuthProvider(provider: AuthOAuthProvider): Promise<AuthSession> {
  const startedAt = flowStart('Auth', 'OAuth 登录开始', { provider })
  const supabase = createExtensionSupabaseClient()
  if (!supabase) {
    flowFail('Auth', 'OAuth 登录开始', startedAt, new Error('supabase_not_configured'))
    throw new Error('supabase_not_configured')
  }

  const redirectUrl = getExtensionOAuthRedirectUrl()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: toSupabaseProvider(provider),
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true
    }
  })

  if (error || !data.url) {
    flowFail('Auth', 'OAuth 登录开始', startedAt, error ?? new Error('oauth_url_missing'))
    throw new Error(error?.message ?? 'oauth_url_missing')
  }

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: data.url,
    interactive: true
  })

  if (!responseUrl) {
    const err = new Error('oauth_cancelled')
    flowFail('Auth', 'OAuth 登录开始', startedAt, err)
    throw err
  }

  const tokens = parseOAuthRedirectTokens(responseUrl)
  if (!tokens) {
    const err = new Error('oauth_tokens_missing')
    flowFail('Auth', 'OAuth 登录开始', startedAt, err)
    throw err
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken
  })

  if (sessionError || !sessionData.session?.user?.id) {
    flowFail(
      'Auth',
      'OAuth 登录开始',
      startedAt,
      sessionError ?? new Error('oauth_session_invalid')
    )
    throw new Error(sessionError?.message ?? 'oauth_session_invalid')
  }

  const authSession = mapSupabaseSessionToAuthSession(sessionData.session)

  flowOk('Auth', 'OAuth 登录开始', startedAt, {
    userId: authSession.userId,
    provider
  })
  return authSession
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
