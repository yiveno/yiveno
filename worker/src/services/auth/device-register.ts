/**
 * POST /api/auth/device-register 业务逻辑（两 mode：website_connect / session_exchange）。
 * 匿名：扩展 GoTrue signup 后走 session_exchange；Worker 不直接建匿名号。
 */

import type { Env } from '../../types/env'
import { verifySupabaseAccessToken } from './verify-supabase-access-token'
import { getUserMeta, issueDeviceToken, putUserMeta, type UserMetaRecord } from './device-token-kv'
import {
  createExtensionUninstallRevokeToken,
  putExtensionUninstallRevokeToken
} from './extension-uninstall-revoke-kv'
import { info, warn } from '../../utils/logger'

type DeviceRegisterSuccess = {
  deviceToken: string
  deviceId: string
  userId: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  isAnonymous: boolean
  /** 一次性卸载票；失败时为 null（扩展仍可 device-revoke-self） */
  uninstallRevokeToken: string | null
}

type DeviceRegisterFailure = {
  ok: false
  status: 400 | 401 | 403 | 429 | 500 | 503
  error: string
}

export type DeviceRegisterResult = { ok: true; data: DeviceRegisterSuccess } | DeviceRegisterFailure

async function ensureUserMeta(
  env: Env,
  userId: string,
  isAnonymous: boolean,
  email: string | null
): Promise<
  { ok: true; meta: UserMetaRecord } | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' }
> {
  const existing = await getUserMeta(env, userId)
  if (existing) {
    // 已有 meta：保留 isAnonymous（转正后旧设备继续有效）
    const next: UserMetaRecord = {
      isAnonymous: existing.isAnonymous,
      updatedAt: new Date().toISOString(),
      ...(email ? { email } : existing.email ? { email: existing.email } : {})
    }
    const put = await putUserMeta(env, userId, next)
    if (!put.ok) return put
    return { ok: true, meta: next }
  }
  const meta: UserMetaRecord = {
    isAnonymous,
    updatedAt: new Date().toISOString(),
    ...(email ? { email } : {})
  }
  const put = await putUserMeta(env, userId, meta)
  if (!put.ok) return put
  return { ok: true, meta }
}

/**
 * 已鉴权用户（website_connect / session_exchange / claim-by-otp）发 device token。
 * 不挤掉其它设备；不写 ext_auth_session；不撤销旧 Supabase 会话。
 * 导出供 claim-by-otp 复用（AN6：可传 deviceLabel/platform）。
 */
export async function issueForAuthenticatedUser(
  env: Env,
  input: {
    userId: string
    email: string | null
    /** 来自 JWT `is_anonymous`；新建 user_meta 时用 */
    isAnonymous: boolean
    extensionId?: string | null
    deviceLabel?: string | null
    platform?: string | null
  }
): Promise<DeviceRegisterResult> {
  const metaEnsured = await ensureUserMeta(env, input.userId, input.isAnonymous, input.email)
  if (!metaEnsured.ok) {
    return { ok: false, status: 503, error: metaEnsured.error }
  }

  const issued = await issueDeviceToken(env, {
    userId: input.userId,
    isAnonymous: metaEnsured.meta.isAnonymous,
    email: metaEnsured.meta.email ?? input.email,
    ...(input.deviceLabel ? { deviceLabel: input.deviceLabel } : {}),
    ...(input.platform ? { platform: input.platform } : {}),
    ...(input.extensionId ? { extensionId: input.extensionId } : {})
  })
  if (!issued.ok) {
    if (issued.error === 'device_limit_reached') {
      return { ok: false, status: 403, error: 'device_limit_reached' }
    }
    return { ok: false, status: 503, error: issued.error }
  }

  // 卸载票：payload={userId,deviceId}；写失败不阻断 register（warn）
  let uninstallRevokeToken: string | null = null
  const candidate = createExtensionUninstallRevokeToken()
  const tokenPut = await putExtensionUninstallRevokeToken(env, candidate, {
    userId: issued.userId,
    deviceId: issued.deviceId,
    extensionId: input.extensionId?.trim() || null,
    createdAt: new Date().toISOString()
  })
  if (tokenPut.ok) {
    uninstallRevokeToken = candidate
  } else {
    warn('[DeviceRegister] 卸载 revoke token 写入失败，继续返回 device', {
      userId: issued.userId,
      deviceId: issued.deviceId,
      error: tokenPut.error
    })
  }

  return {
    ok: true,
    data: {
      deviceToken: issued.deviceToken,
      deviceId: issued.deviceId,
      userId: issued.userId,
      email: issued.email,
      displayName: null,
      avatarUrl: null,
      isAnonymous: issued.isAnonymous,
      uninstallRevokeToken
    }
  }
}

export type VerifyAccessTokenFn = typeof verifySupabaseAccessToken

/**
 * 从 Authorization 取出并校验 Supabase access（注册端点内联鉴权）。
 */
async function requireSupabaseUser(
  env: Env,
  request: Request,
  verifyFn: VerifyAccessTokenFn = verifySupabaseAccessToken
): Promise<
  | { ok: true; userId: string; email: string | null; isAnonymous: boolean }
  | { ok: false; status: 401 | 500 | 503; error: string }
> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'missing_authorization' }
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    return { ok: false, status: 401, error: 'missing_authorization' }
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { ok: false, status: 500, error: 'supabase_not_configured' }
  }
  const verified = await verifyFn(env.SUPABASE_URL, token, {
    anonKey: env.SUPABASE_ANON_KEY
  })
  if (!verified.ok) {
    if (verified.reason === 'auth_unreachable') {
      return { ok: false, status: 503, error: 'auth_unreachable' }
    }
    return { ok: false, status: 401, error: 'invalid_token' }
  }
  return {
    ok: true,
    userId: verified.user.id,
    email: verified.user.email,
    isAnonymous: verified.user.isAnonymous
  }
}

export type DeviceRegisterBody = {
  mode?: unknown
  extensionId?: unknown
  deviceLabel?: unknown
  platform?: unknown
}

/**
 * 处理设备注册两 mode。
 * @param options.verifyAccessToken 测试可注入，避免 mock.module 污染其它套件
 */
export async function handleDeviceRegister(
  env: Env,
  request: Request,
  body: DeviceRegisterBody,
  options?: { verifyAccessToken?: VerifyAccessTokenFn }
): Promise<DeviceRegisterResult> {
  const mode = body.mode
  if (mode !== 'website_connect' && mode !== 'session_exchange') {
    return { ok: false, status: 400, error: 'invalid_mode' }
  }

  const extensionId =
    typeof body.extensionId === 'string' && body.extensionId.trim() ? body.extensionId.trim() : null
  const deviceLabel =
    typeof body.deviceLabel === 'string' && body.deviceLabel.trim() ? body.deviceLabel.trim() : null
  const platform =
    typeof body.platform === 'string' && body.platform.trim() ? body.platform.trim() : null

  // website_connect | session_exchange：须 Supabase Bearer；不撤销旧会话
  const auth = await requireSupabaseUser(
    env,
    request,
    options?.verifyAccessToken ?? verifySupabaseAccessToken
  )
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error }
  }

  info('[DeviceRegister] 已鉴权用户发 device token', {
    mode,
    userId: auth.userId,
    isAnonymous: auth.isAnonymous,
    hasExtensionId: Boolean(extensionId)
  })

  return issueForAuthenticatedUser(env, {
    userId: auth.userId,
    email: auth.email,
    isAnonymous: auth.isAnonymous,
    extensionId,
    deviceLabel,
    platform
  })
}
