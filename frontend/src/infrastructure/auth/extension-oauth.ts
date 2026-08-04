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
 * 使用 refresh_token 刷新会话。
 * previous 保留旧头像/展示名，避免 refresh 响应缺 metadata 时被冲掉。
 *
 * 失败区分：
 * - invalid：refresh_token 明确作废（官网退出等）→ 可清本地登录态
 * - transient：网络/5xx/未配置等 → **不得**当退出处理
 */
export type RefreshAuthSessionResult =
  | { status: 'ok'; session: AuthSession }
  | { status: 'invalid'; reason: string }
  | { status: 'transient'; reason: string }

/** 从 Supabase / fetch 错误判断是否应清登录态。默认偏 transient，避免偶发网络误踢。 */
export function classifyAuthRefreshFailure(error: unknown): 'invalid' | 'transient' {
  if (error == null) {
    return 'transient'
  }

  const record =
    typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null
  const status =
    typeof record?.status === 'number'
      ? record.status
      : typeof record?.statusCode === 'number'
        ? record.statusCode
        : undefined
  const name = typeof record?.name === 'string' ? record.name : ''
  const code = typeof record?.code === 'string' ? record.code.toLowerCase() : ''
  const message =
    (typeof record?.message === 'string' ? record.message : '') ||
    (error instanceof Error ? error.message : String(error))
  const lower = `${code} ${message}`.toLowerCase()

  if (
    name === 'AuthRetryableFetchError' ||
    status === 0 ||
    status === 408 ||
    status === 429 ||
    (typeof status === 'number' && status >= 500)
  ) {
    return 'transient'
  }

  if (
    lower.includes('invalid_grant') ||
    lower.includes('refresh_token_not_found') ||
    lower.includes('refresh_token_already_used') ||
    lower.includes('session_not_found') ||
    lower.includes('session_expired') ||
    lower.includes('invalid refresh token') ||
    lower.includes('refresh token not found')
  ) {
    return 'invalid'
  }

  // 明确 4xx 且非上述文案：仍偏 transient，避免未知 400 误踢
  return 'transient'
}

/**
 * 详细 refresh；供 revalidate 区分 invalid / transient。
 */
export async function refreshAuthSessionDetailed(
  refreshToken: string,
  previous?: Pick<AuthSession, 'avatarUrl' | 'displayName' | 'email'> | null
): Promise<RefreshAuthSessionResult> {
  const supabase = createExtensionSupabaseClient()
  if (!supabase) {
    return { status: 'transient', reason: 'supabase_not_configured' }
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    if (error) {
      const kind = classifyAuthRefreshFailure(error)
      return {
        status: kind,
        reason: error.message || error.name || 'refresh_error'
      }
    }
    if (!data.session?.user?.id) {
      return { status: 'invalid', reason: 'missing_session' }
    }
    return {
      status: 'ok',
      session: mapSupabaseSessionToAuthSession(data.session, previous)
    }
  } catch (error) {
    const kind = classifyAuthRefreshFailure(error)
    return {
      status: kind,
      reason: error instanceof Error ? error.message : 'refresh_threw'
    }
  }
}

/**
 * 使用 refresh_token 刷新会话；失败返回 null（不区分原因，兼容旧调用方）。
 */
export async function refreshAuthSession(
  refreshToken: string,
  previous?: Pick<AuthSession, 'avatarUrl' | 'displayName' | 'email'> | null
): Promise<AuthSession | null> {
  const result = await refreshAuthSessionDetailed(refreshToken, previous)
  return result.status === 'ok' ? result.session : null
}

/**
 * 用 access token 调 getUser，把最新 user_metadata 写回头像 / 展示名 / email。
 * 专供「刷新资料」与 Header 缺头像自愈；不走热路径。
 * @returns 更新后的 session；失败返回 null
 */
export async function refreshAuthProfileFields(session: AuthSession): Promise<AuthSession | null> {
  const supabase = createExtensionSupabaseClient(session.accessToken)
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getUser(session.accessToken)
  if (error || !data.user?.id) {
    return null
  }

  const rawMetadata = data.user.user_metadata
  const metadata =
    rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, unknown>)
      : undefined
  const avatarUrl = extractAvatarUrlFromUserMetadata(metadata) ?? session.avatarUrl
  const displayName = extractDisplayNameFromUserMetadata(metadata) ?? session.displayName
  const email = data.user.email?.trim() || session.email

  return {
    ...session,
    ...(email ? { email } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(displayName ? { displayName } : {})
  }
}
