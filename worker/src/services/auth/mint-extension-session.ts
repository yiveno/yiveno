/**
 * 为 Chrome 扩展另开一条 Supabase Auth 会话（独立 refresh 族）+ 单活跃租约。
 *
 * - 官网 OAuth 会话不得直接 handoff 共用 refresh；官网可多端同登，**不**因挤掉扩展而撤销。
 * - **互斥铁律仅针对扩展**：同一账号同时只允许一条扩展登录（本机库/书签等不可多机共存）。
 *   互斥维度 = Auth `session` / KV 租约，不是 `chrome.runtime.id`。
 * - KV 已有租约且未 `confirmDisplace` → `needs_displace_confirm`（家里登录挤掉上班那台扩展）。
 * - 确认后：**先**硬撤前序扩展 Auth session（可重试）；成功后才铸造新 session 并写 KV。
 *   撤销失败 → `displace_revoke_failed`，**不**发新会话（防双端短暂同登污染本机库/云同步）。
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
  /** 用户已确认挤掉其它已登录的扩展会话（不触及官网会话） */
  confirmDisplace?: boolean
  /**
   * Chrome 扩展包 id（CWS / 未打包路径派生；各安装副本通常相同）。
   * 仅写入租约与卸载 revoke 元数据，**不**用于跳过挤掉确认。
   */
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
        | 'displace_revoke_failed'
      /** 仅 needs_displace_confirm */
      existingMintedAt?: string
    }

const DISPLACE_REVOKE_ATTEMPTS = 3 as const

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

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * 硬撤前序扩展 Auth session（带短重试）。
 * 成功后前者 refresh 失效，云同步无法再以该会话写库。
 */
async function revokePreviousExtensionSession(
  env: Env,
  userId: string,
  sessionId: string
): Promise<boolean> {
  for (let attempt = 1; attempt <= DISPLACE_REVOKE_ATTEMPTS; attempt++) {
    const ok = await revokeAuthSessionById(env, userId, sessionId)
    if (ok) {
      return true
    }
    warn('[Auth] 前序扩展 Auth session 撤销未确认，重试', {
      userId,
      sessionId,
      attempt,
      maxAttempts: DISPLACE_REVOKE_ATTEMPTS
    })
    if (attempt < DISPLACE_REVOKE_ATTEMPTS) {
      await sleepMs(150 * attempt)
    }
  }
  return false
}

/**
 * 为已认证用户铸造扩展专用 session（扩展单活跃）。
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

  // 确认挤掉：先硬撤前序扩展 session，成功后才铸造（可靠性优先于速度）
  let displacedSessionId: string | null = null
  if (existingLease && options.confirmDisplace === true) {
    if (existingLease.uninstallRevokeToken) {
      await deleteExtensionUninstallRevokeToken(env, existingLease.uninstallRevokeToken)
    }
    const leaseRevoked = await revokePreviousExtensionSession(env, userId, existingLease.sessionId)
    if (!leaseRevoked) {
      logErrorMessage('[Auth] 前序扩展 Auth session 撤销失败，中止铸造（防双端污染）', {
        userId,
        previousSessionId: existingLease.sessionId
      })
      return { ok: false, error: 'displace_revoke_failed' }
    }
    info('[Auth] 已撤销前序扩展 Auth session，开始铸造新扩展会话', {
      userId,
      previousSessionId: existingLease.sessionId
    })
    displacedSessionId = existingLease.sessionId
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
