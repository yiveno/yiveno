/**
 * 为 Chrome 扩展另开一条 Supabase Auth 会话（独立 refresh 族）+ 单活跃租约。
 *
 * - 官网 OAuth 会话不得直接 handoff 共用 refresh。
 * - **互斥维度 = 账号下的扩展登录会话（KV 租约 / sessionId）**，不是 `chrome.runtime.id`。
 *   CWS 分配的 extensionId 全机相同，只作租约元数据 / 卸载 token 附属，**不**决定是否弹确认。
 * - KV 已有租约且未 `confirmDisplace` → `needs_displace_confirm`（家里登录挤掉上班那台）。
 * - 确认后：铸造新 session → 撤销该用户其它 Auth session（含前序扩展与官网）→ 写新租约。
 *   保留：新扩展 session + 本次 mint 的官网 Bearer session。
 * - KV 不可用 / 读不到租约：不弹确认，照常 mint（降级）。
 */

import { createClient } from '@supabase/supabase-js'
import { createSupabaseClient } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, toLogError, warn } from '../../utils/logger'
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
import { revokeOtherAuthSessions } from './revoke-other-auth-sessions'

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
  /** 用户已确认挤掉其它已登录的扩展会话 */
  confirmDisplace?: boolean
  /**
   * Chrome 扩展包 id（CWS / 未打包路径派生；各安装副本通常相同）。
   * 仅写入租约与卸载 revoke 元数据，**不**用于跳过挤掉确认。
   */
  extensionId?: string
  /**
   * 本次 mint 请求的官网 access JWT 的 session_id。
   * 挤掉时保留该官网会话，避免把后者官网一并踢掉。
   */
  keepWebsiteSessionId?: string
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
        | 'displace_revoke_failed' // 确认挤掉后未能作废前序 session
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

  // 已有扩展登录会话租约 → 须用户确认后再挤掉（与 extensionId 是否相同无关）
  if (existingLease && options.confirmDisplace !== true) {
    info('[Auth] 账号已有扩展登录会话租约，需确认挤掉', {
      userId,
      mintedAt: existingLease.mintedAt,
      leaseSessionId: existingLease.sessionId,
      leaseExtensionId: existingLease.extensionId ?? null,
      requestExtensionId
    })
    return {
      ok: false,
      error: 'needs_displace_confirm',
      existingMintedAt: existingLease.mintedAt
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

    // 有前序租约：作废该用户其它会话（含前序扩展 + 前者官网），保留新扩展与本次官网 Bearer
    if (existingLease && existingLease.sessionId !== sessionId) {
      if (existingLease.uninstallRevokeToken) {
        await deleteExtensionUninstallRevokeToken(env, existingLease.uninstallRevokeToken)
      }
      const keepIds = [sessionId, options.keepWebsiteSessionId?.trim() || null].filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
      const others = await revokeOtherAuthSessions(env, userId, keepIds)
      if (!others.ok) {
        warn('[Auth] 挤掉其它会话失败，回滚本次新 session', {
          userId,
          previousSessionId: existingLease.sessionId,
          newSessionId: sessionId,
          reason: others.reason
        })
        if (sessionId) {
          await revokeAuthSessionById(env, userId, sessionId)
        }
        return { ok: false, error: 'displace_revoke_failed' }
      }
      displacedSessionId = existingLease.sessionId
      info('[Auth] 已挤掉前序扩展及其它会话', {
        userId,
        previousSessionId: existingLease.sessionId,
        revokedCount: others.revokedCount
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
