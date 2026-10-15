/**
 * Admin generateLink + anon verifyOtp：为指定用户签发一条新的 Supabase Auth 会话。
 * 官网 / 扩展 mint 共用；调用方自行决定是否写扩展租约。
 */

import { createClient } from '@supabase/supabase-js'
import { createSupabaseClient } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, toLogError, warn } from '../../utils/logger'
import { readJwtSessionId } from './read-jwt-session-id'

export type IssuedSupabaseUserSession = {
  accessToken: string
  refreshToken: string
  userId: string
  email: string | null
  expiresAt: number | null
  sessionId: string | null
}

export type IssueSupabaseUserSessionResult =
  | { ok: true; session: IssuedSupabaseUserSession }
  | {
      ok: false
      error:
        | 'supabase_not_configured'
        | 'email_required'
        | 'generate_link_failed'
        | 'verify_otp_failed'
        | 'user_mismatch'
    }

/**
 * 为已认证 userId 铸造一条新 session（独立 refresh）。
 * @param logTag 日志前缀，如 `[Auth] website-session`
 */
export async function issueSupabaseUserSession(
  env: Env,
  userId: string,
  emailFromJwt: string | null,
  logTag: string
): Promise<IssueSupabaseUserSessionResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: 'supabase_not_configured' }
  }

  const admin = createSupabaseClient(env)
  if (!admin) {
    return { ok: false, error: 'supabase_not_configured' }
  }

  let email = emailFromJwt?.trim() || null
  if (!email) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error) {
        warn(`${logTag} 取用户失败`, { userId, detail: toLogError(error) })
      } else {
        email = data.user?.email?.trim() || null
      }
    } catch (err) {
      logErrorMessage(`${logTag} getUserById 异常`, { userId, detail: toLogError(err) })
    }
  }

  if (!email) {
    return { ok: false, error: 'email_required' }
  }

  let hashedToken: string | undefined
  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      warn(`${logTag} generateLink 失败`, {
        userId,
        detail: linkError ? toLogError(linkError) : 'missing_hashed_token'
      })
      return { ok: false, error: 'generate_link_failed' }
    }
    if (linkData.user?.id && linkData.user.id !== userId) {
      warn(`${logTag} generateLink 用户不一致`, {
        userId,
        linkUserId: linkData.user.id
      })
      return { ok: false, error: 'user_mismatch' }
    }
    hashedToken = linkData.properties.hashed_token
  } catch (err) {
    logErrorMessage(`${logTag} generateLink 异常`, { userId, detail: toLogError(err) })
    return { ok: false, error: 'generate_link_failed' }
  }

  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    const { data: otpData, error: otpError } = await anon.auth.verifyOtp({
      type: 'email',
      token_hash: hashedToken
    })
    if (otpError || !otpData.session?.access_token || !otpData.session.refresh_token) {
      warn(`${logTag} verifyOtp 失败`, {
        userId,
        detail: otpError ? toLogError(otpError) : 'missing_session'
      })
      return { ok: false, error: 'verify_otp_failed' }
    }
    if (otpData.session.user.id !== userId) {
      warn(`${logTag} verifyOtp 用户不一致`, {
        userId,
        sessionUserId: otpData.session.user.id
      })
      return { ok: false, error: 'user_mismatch' }
    }

    const accessToken = otpData.session.access_token
    const refreshToken = otpData.session.refresh_token
    const expiresAt =
      typeof otpData.session.expires_at === 'number' ? otpData.session.expires_at : null

    return {
      ok: true,
      session: {
        accessToken,
        refreshToken,
        userId,
        email: otpData.session.user.email?.trim() || email,
        expiresAt,
        sessionId: readJwtSessionId(accessToken)
      }
    }
  } catch (err) {
    logErrorMessage(`${logTag} verifyOtp 异常`, { userId, detail: toLogError(err) })
    return { ok: false, error: 'verify_otp_failed' }
  }
}
