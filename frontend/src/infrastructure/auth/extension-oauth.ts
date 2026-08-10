import type { AuthSession } from '@/core/identity/auth-session'
import {
  extractAvatarUrlFromUserMetadata,
  extractDisplayNameFromUserMetadata
} from '@/core/identity/auth-user-profile'
import { getSupabasePublicConfig } from '@/infrastructure/auth/supabase-client'
import { logger } from '@/infrastructure/logging/logger'

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

type SupabaseUserResponse = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
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

  // Service Worker 无 window：任何依赖 DOM 的客户端路径一律视为瞬时失败
  if (
    name === 'ReferenceError' ||
    lower.includes('window is not defined') ||
    lower.includes('document is not defined')
  ) {
    return 'transient'
  }

  if (
    name === 'AuthRetryableFetchError' ||
    status === 0 ||
    status === 408 ||
    status === 429 ||
    (typeof status === 'number' && status >= 500)
  ) {
    return 'transient'
  }

  // 并发 refresh：A 已轮换 token，B 仍持旧 refresh → Already Used。
  // 必须先于「invalid refresh token」广义匹配；不得当 invalid 清登录（会清掉 A 刚写入的新 session）。
  if (lower.includes('already used') || lower.includes('refresh_token_already_used')) {
    return 'transient'
  }

  if (
    lower.includes('invalid_grant') ||
    lower.includes('refresh_token_not_found') ||
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

type RefreshTokenApiResponse = {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  expires_in?: number
  user?: SupabaseUserResponse | null
  error?: string
  error_description?: string
  msg?: string
  message?: string
}

/**
 * Service Worker 安全：不经 @supabase/supabase-js（其 GoTrue 会在 init 路径碰 window）。
 * 直接 POST /auth/v1/token?grant_type=refresh_token。
 */
async function refreshSessionViaFetch(
  refreshToken: string
): Promise<
  | { ok: true; session: SupabaseAuthSessionLike }
  | { ok: false; kind: 'invalid' | 'transient'; reason: string }
> {
  const config = getSupabasePublicConfig()
  if (!config) {
    return { ok: false, kind: 'transient', reason: 'supabase_not_configured' }
  }

  const url = `${config.url.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${config.anonKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
  } catch (error) {
    return {
      ok: false,
      kind: 'transient',
      reason: error instanceof Error ? error.message : 'refresh_network_error'
    }
  }

  const payload = (await response.json().catch(() => ({}))) as RefreshTokenApiResponse
  if (!response.ok) {
    const reason =
      payload.error_description ||
      payload.msg ||
      payload.message ||
      payload.error ||
      `http_${response.status}`
    const kind = classifyAuthRefreshFailure({
      status: response.status,
      message: reason,
      code: payload.error
    })
    return { ok: false, kind, reason }
  }

  const accessToken = payload.access_token?.trim()
  const nextRefresh = payload.refresh_token?.trim() || refreshToken
  const user = payload.user
  if (!accessToken || !user?.id) {
    return { ok: false, kind: 'invalid', reason: 'missing_session' }
  }

  const expiresAt =
    typeof payload.expires_at === 'number'
      ? payload.expires_at
      : typeof payload.expires_in === 'number'
        ? Math.floor(Date.now() / 1000) + payload.expires_in
        : undefined

  return {
    ok: true,
    session: {
      access_token: accessToken,
      refresh_token: nextRefresh,
      ...(expiresAt != null ? { expires_at: expiresAt } : {}),
      user: {
        id: user.id,
        ...(user.email != null ? { email: user.email } : {}),
        ...(user.user_metadata != null ? { user_metadata: user.user_metadata } : {})
      }
    }
  }
}

/**
 * 详细 refresh；供 revalidate 区分 invalid / transient。
 * 使用裸 fetch，避免 Service Worker 中 supabase-js 触发 window ReferenceError。
 */
export async function refreshAuthSessionDetailed(
  refreshToken: string,
  previous?: Pick<AuthSession, 'avatarUrl' | 'displayName' | 'email'> | null
): Promise<RefreshAuthSessionResult> {
  try {
    const result = await refreshSessionViaFetch(refreshToken)
    if (!result.ok) {
      return { status: result.kind, reason: result.reason }
    }
    return {
      status: 'ok',
      session: mapSupabaseSessionToAuthSession(result.session, previous)
    }
  } catch (error) {
    const kind = classifyAuthRefreshFailure(error)
    logger.warn('Auth', 'refreshSession 抛错（按瞬时失败保留登录态）', {
      kind,
      error: error instanceof Error ? error.message : String(error)
    })
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
 * Service Worker 安全：裸 fetch /auth/v1/user。
 * @returns 更新后的 session；失败返回 null
 */
export async function refreshAuthProfileFields(session: AuthSession): Promise<AuthSession | null> {
  const config = getSupabasePublicConfig()
  if (!config) {
    return null
  }

  try {
    const url = `${config.url.replace(/\/$/, '')}/auth/v1/user`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${session.accessToken}`
      }
    })
    if (!response.ok) {
      return null
    }
    const user = (await response.json().catch(() => null)) as SupabaseUserResponse | null
    if (!user?.id) {
      return null
    }

    const rawMetadata = user.user_metadata
    const metadata =
      rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
        ? rawMetadata
        : undefined
    const avatarUrl = extractAvatarUrlFromUserMetadata(metadata) ?? session.avatarUrl
    const displayName = extractDisplayNameFromUserMetadata(metadata) ?? session.displayName
    const email = user.email?.trim() || session.email

    return {
      ...session,
      ...(email ? { email } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(displayName ? { displayName } : {})
    }
  } catch (error) {
    logger.warn('Auth', '刷新资料字段失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}
