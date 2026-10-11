/**
 * 为 Chrome 扩展另开一条 Supabase Auth 会话（独立 refresh 族）+ 单活跃租约。
 *
 * - 官网 OAuth 会话不得直接 handoff 共用 refresh。
 * - 扩展侧同时只允许一台：KV 有既有租约且 Auth 侧 session 仍存活、未 confirmDisplace → needs_displace_confirm。
 * - KV 租约在、但 auth.sessions 已无（重装扩展 / 已退登僵死）→ 清租约，不弹确认。
 * - 确认后：铸造新 session → 撤销旧 auth.sessions 行 → 写新租约。
 * - KV 不可用 / 读不到租约：不弹确认，照常 mint（降级）。
 */

import { createClient } from '@supabase/supabase-js'
import { createSupabaseClient } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, toLogError, warn } from '../../utils/logger'
import { authSessionExists } from './auth-session-exists'
import {
  clearExtensionSessionLease,
  getExtensionSessionLease,
  putExtensionSessionLease
} from './extension-session-lease-kv'
import {
  createExtensionUninstallRevokeToken,
  deleteExtensionUninstallRevokeToken,
  putExtensionUninstallRevokeToken
} from './extension-uninstall-revoke-kv'
import { readJwtSessionId } from './read-jwt-session-id'
import { revokeAuthSessionById } from './revoke-auth-session'

export type MintedExtensionSession = {
  accessToken: string
  refreshToken: string
  userId: string
  email: string | null
  expiresAt: number | null
  sessionId: string | null
  /** 扩展 setUninstallURL 用；KV 不可用时为 null */
  uninstallRevokeToken: string | null
}

export type MintExtensionSessionOptions = {
  /** 用户已确认挤掉其它扩展会话 */
  confirmDisplace?: boolean
  /** 本次 handoff 目标 Chrome 扩展 id（同 id 重连不弹确认） */
  extensionId?: string
}

export type MintExtensionSessionResult =
  | {
      ok: true
      session: MintedExtensionSession
      displacedSessionId: string | null
    }
  | {
      ok: false
      error:
        | 'supabase_not_configured'
        | 'email_required'
        | 'generate_link_failed'
        | 'verify_otp_failed'
        | 'user_mismatch'
        | 'needs_displace_confirm'
      /** 仅 needs_displace_confirm */
      existingMintedAt?: string
    }

/** 清租约并作废其上挂的卸载 revoke token（若有）。 */
async function clearLeaseAndUninstallToken(
  env: Env,
  userId: string,
  lease: { uninstallRevokeToken?: string } | null
): Promise<void> {
  if (lease?.uninstallRevokeToken) {
    await deleteExtensionUninstallRevokeToken(env, lease.uninstallRevokeToken)
  }
  await clearExtensionSessionLease(env, userId)
}

/**
 * 为已认证用户铸造扩展专用 session（单活跃）。
 */
export async function mintExtensionSession(
  env: Env,
  userId: string,
  emailFromJwt: string | null,
  options: MintExtensionSessionOptions = {}
): Promise<MintExtensionSessionResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: 'supabase_not_configured' }
  }

  const requestExtensionId = options.extensionId?.trim() || null
  let existingLease = await getExtensionSessionLease(env, userId)

  // 旧租约无 extensionId：无法区分「真·另一端」与测试僵死，清掉后放行（此后租约均带 id）
  if (existingLease && !existingLease.extensionId) {
    info('[Auth] 清除无 extensionId 的旧扩展租约', { userId })
    await clearLeaseAndUninstallToken(env, userId, existingLease)
    existingLease = null
  }

  if (existingLease && options.confirmDisplace !== true) {
    const sameExtension =
      Boolean(requestExtensionId) &&
      Boolean(existingLease.extensionId) &&
      requestExtensionId === existingLease.extensionId

    if (sameExtension) {
      // 同扩展重连：不弹确认。仅在能确认 Auth 行已无时清僵死租约标记（仍继续 mint）
      const alive = await authSessionExists(env, userId, existingLease.sessionId)
      if (alive.status === 'missing') {
        info('[Auth] 同扩展重连且旧 session 已不在，清租约后换发', {
          userId,
          extensionId: requestExtensionId
        })
        await clearLeaseAndUninstallToken(env, userId, existingLease)
        existingLease = null
      } else {
        info('[Auth] 同扩展重连，跳过挤掉确认', {
          userId,
          extensionId: requestExtensionId
        })
      }
    } else {
      // 不同 extension id（或未带 id）：一律确认。禁止用 auth.sessions「missing」清租约放行
      // （PostgREST 读不到 auth schema 时会误判 missing，导致互斥失效）
      info('[Auth] 其它扩展会话租约仍在，需确认挤掉', {
        userId,
        mintedAt: existingLease.mintedAt,
        leaseExtensionId: existingLease.extensionId ?? null,
        requestExtensionId
      })
      return {
        ok: false,
        error: 'needs_displace_confirm',
        existingMintedAt: existingLease.mintedAt
      }
    }
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
        warn('[Auth] mint extension-session 取用户失败', {
          userId,
          detail: toLogError(error)
        })
      } else {
        email = data.user?.email?.trim() || null
      }
    } catch (err) {
      logErrorMessage('[Auth] mint extension-session getUserById 异常', {
        userId,
        detail: toLogError(err)
      })
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
      warn('[Auth] mint extension-session generateLink 失败', {
        userId,
        detail: linkError ? toLogError(linkError) : 'missing_hashed_token'
      })
      return { ok: false, error: 'generate_link_failed' }
    }
    if (linkData.user?.id && linkData.user.id !== userId) {
      warn('[Auth] mint extension-session generateLink 用户不一致', {
        userId,
        linkUserId: linkData.user.id
      })
      return { ok: false, error: 'user_mismatch' }
    }
    hashedToken = linkData.properties.hashed_token
  } catch (err) {
    logErrorMessage('[Auth] mint extension-session generateLink 异常', {
      userId,
      detail: toLogError(err)
    })
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
      warn('[Auth] mint extension-session verifyOtp 失败', {
        userId,
        detail: otpError ? toLogError(otpError) : 'missing_session'
      })
      return { ok: false, error: 'verify_otp_failed' }
    }
    if (otpData.session.user.id !== userId) {
      warn('[Auth] mint extension-session verifyOtp 用户不一致', {
        userId,
        sessionUserId: otpData.session.user.id
      })
      return { ok: false, error: 'user_mismatch' }
    }

    const accessToken = otpData.session.access_token
    const sessionId = readJwtSessionId(accessToken)
    let displacedSessionId: string | null = null

    if (existingLease && existingLease.sessionId !== sessionId) {
      if (existingLease.uninstallRevokeToken) {
        await deleteExtensionUninstallRevokeToken(env, existingLease.uninstallRevokeToken)
      }
      const revoked = await revokeAuthSessionById(env, userId, existingLease.sessionId)
      displacedSessionId = existingLease.sessionId
      info('[Auth] 已挤掉前序扩展会话', {
        userId,
        previousSessionId: existingLease.sessionId,
        revoked
      })
    }

    let uninstallRevokeToken: string | null = null
    if (sessionId) {
      const candidate = createExtensionUninstallRevokeToken()
      const tokenPut = await putExtensionUninstallRevokeToken(env, candidate, {
        userId,
        sessionId,
        extensionId: requestExtensionId,
        createdAt: new Date().toISOString()
      })
      if (tokenPut.ok) {
        uninstallRevokeToken = candidate
      } else {
        warn('[Auth] 卸载 revoke token 写入失败（仍返回新 session）', { userId })
      }

      const leasePut = await putExtensionSessionLease(env, userId, {
        sessionId,
        mintedAt: new Date().toISOString(),
        ...(requestExtensionId ? { extensionId: requestExtensionId } : {}),
        ...(uninstallRevokeToken ? { uninstallRevokeToken } : {})
      })
      if (!leasePut.ok) {
        warn('[Auth] 扩展会话租约写入失败（仍返回新 session）', { userId })
      }
    } else {
      warn('[Auth] 新 session 无 session_id claim，跳过租约/卸载 token 写入', { userId })
    }

    info('[Auth] 已铸造扩展独立 session', {
      userId,
      displaced: Boolean(displacedSessionId),
      hasUninstallRevokeToken: Boolean(uninstallRevokeToken)
    })
    return {
      ok: true,
      displacedSessionId,
      session: {
        accessToken,
        refreshToken: otpData.session.refresh_token,
        userId: otpData.session.user.id,
        email: otpData.session.user.email ?? email,
        expiresAt: otpData.session.expires_at ?? null,
        sessionId,
        uninstallRevokeToken
      }
    }
  } catch (err) {
    logErrorMessage('[Auth] mint extension-session verifyOtp 异常', {
      userId,
      detail: toLogError(err)
    })
    return { ok: false, error: 'verify_otp_failed' }
  }
}
