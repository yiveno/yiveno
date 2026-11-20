/**
 * 认证路由
 *
 * - 遗留：自建 OAuth → 自定义 JWT（非 Phase C 主路径）
 * - D 方案：`POST /device-register` 发设备 token；`POST /device-revoke-self` 撤本设备
 * - 旧 `POST /extension-session` → 410（设计 §2.1 推荐 ②）
 * - `POST /website-session`：扩展双栈 Bearer 为官网铸造独立会话
 * - `POST /extension-session-release` / uninstall-revoke：过渡期仍保留
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleAuthProviders, handleAuthStart, handleAuthCallback } from '../handlers/auth'
import { deviceAuth, invalidateDeviceAuthCacheEntry } from '../middleware/device-auth'
import { deviceAuthOrSupabaseAuth } from '../middleware/device-or-supabase-auth'
import { supabaseAuth } from '../middleware/supabase-auth'
import { consumeExtensionUninstallRevoke } from '../services/auth/consume-extension-uninstall-revoke'
import { handleDeviceRegister } from '../services/auth/device-register'
import { revokeDeviceTokenSelf } from '../services/auth/device-token-kv'
import { mintWebsiteSessionFromExtension } from '../services/auth/mint-website-session'
import { probeExtensionSessionLease } from '../services/auth/probe-extension-session-lease'
import { releaseExtensionSessionByAccessToken } from '../services/auth/release-extension-session'
import { error as logErrorMessage, info } from '../utils/logger'

type AuthVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
    deviceIsAnonymous?: boolean
    deviceId?: string
  }
}

export const authRouter = new Hono<AuthVars>()

/**
 * GET /api/auth/providers
 *
 * 获取可用的 OAuth 提供商列表
 */
authRouter.get('/providers', async c => {
  const request = c.req.raw
  const env = c.env
  const origin = request.headers.get('origin')

  return handleAuthProviders(request, env, origin)
})

/**
 * GET /api/auth/start
 *
 * 开始 OAuth 认证流程
 */
authRouter.get('/start', async c => {
  const request = c.req.raw
  const env = c.env
  const origin = request.headers.get('origin')

  return handleAuthStart(request, env, origin)
})

/**
 * GET /api/auth/callback
 *
 * OAuth 认证回调
 */
authRouter.get('/callback', async c => {
  const request = c.req.raw
  const env = c.env
  const origin = request.headers.get('origin')

  return handleAuthCallback(request, env, origin)
})

/**
 * POST /api/auth/device-register
 *
 * 扩展首次拿 device token（website_connect / session_exchange）。
 * 鉴权按 mode 内联；不写 ext_auth_session、不挤掉其它设备。
 */
authRouter.post('/device-register', async c => {
  let body: Record<string, unknown> = {}
  try {
    const parsed = await c.req.json().catch(() => null)
    if (typeof parsed === 'object' && parsed !== null) {
      body = parsed as Record<string, unknown>
    }
  } catch {
    body = {}
  }

  try {
    const result = await handleDeviceRegister(c.env, c.req.raw, body)
    if (!result.ok) {
      return c.json({ error: result.error }, result.status)
    }
    info('[Auth] device-register 已返回', {
      userId: result.data.userId,
      deviceId: result.data.deviceId,
      isAnonymous: result.data.isAnonymous
    })
    return c.json({ success: true, data: result.data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] device-register 异常', { detail: msg })
    return c.json({ error: 'device_register_failed' }, 500)
  }
})

/**
 * POST /api/auth/device-revoke-self
 *
 * 扩展 Settings 退出：撤**本** device token。
 */
authRouter.post('/device-revoke-self', deviceAuth(), async c => {
  const authHeader = c.req.header('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
  const userId = c.get('supabaseUserId')
  try {
    const result = await revokeDeviceTokenSelf(c.env, token)
    if (!result.ok) {
      return c.json({ error: result.error }, 503)
    }
    if (token) {
      invalidateDeviceAuthCacheEntry(token)
    }
    info('[Auth] device-revoke-self', {
      userId,
      revoked: result.revoked,
      deviceId: result.deviceId ?? null
    })
    return c.json({ success: true, data: { revoked: result.revoked } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] device-revoke-self 异常', { userId, detail: msg })
    return c.json({ error: 'device_revoke_failed' }, 500)
  }
})

/**
 * POST /api/auth/extension-session
 *
 * 已弃用（D 方案改走 `/device-register`）。返回 410 Gone。
 * 注意：过渡期旧扩展 Connect 会断；不得擅自改回旧 mint 行为（见汇报）。
 */
authRouter.post('/extension-session', async c => {
  return c.json(
    {
      error: 'gone',
      message: 'Use POST /api/auth/device-register'
    },
    410
  )
})

/**
 * GET /api/auth/extension-session-lease
 *
 * 扩展探测本 Bearer 是否仍为账号下活跃扩展租约（对照 KV sessionId）。
 * 被挤掉 → `{ active: false, reason: 'displaced' }`；供 GET_AUTH_STATE 在 Supabase refresh 限流时仍能退登。
 */
authRouter.get('/extension-session-lease', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  const accessToken = c.get('supabaseAccessToken')
  try {
    const result = await probeExtensionSessionLease(c.env, userId, accessToken)
    if (result.status === 'displaced') {
      info('[Auth] extension-session-lease 探测到被挤掉', { userId })
      return c.json({ success: true, data: { active: false, reason: 'displaced' as const } })
    }
    if (result.status === 'unknown') {
      return c.json({ success: true, data: { active: true, reason: 'unknown' as const } })
    }
    return c.json({ success: true, data: { active: true, reason: 'lease_match' as const } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] extension-session-lease 异常', { userId, detail: msg })
    return c.json({ error: 'lease_probe_failed' }, 500)
  }
})

/**
 * POST /api/auth/website-session
 *
 * Bearer=扩展 access 或 device token。为官网铸造独立会话（反向接通）；**不**改扩展租约。
 */
authRouter.post('/website-session', deviceAuthOrSupabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  const email = c.get('supabaseUserEmail')
  try {
    const result = await mintWebsiteSessionFromExtension(c.env, userId, email)
    if (!result.ok) {
      const status =
        result.error === 'supabase_not_configured'
          ? 500
          : result.error === 'email_required'
            ? 400
            : 502
      logErrorMessage('[Auth] website-session 铸造失败', { userId, error: result.error })
      return c.json({ error: result.error }, status)
    }
    info('[Auth] website-session 已返回', { userId })
    return c.json({
      success: true,
      data: {
        accessToken: result.session.accessToken,
        refreshToken: result.session.refreshToken,
        userId: result.session.userId,
        email: result.session.email,
        expiresAt: result.session.expiresAt
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] website-session 异常', { userId, detail: msg })
    return c.json({ error: 'website_session_failed' }, 500)
  }
})

/**
 * POST /api/auth/extension-session-release
 *
 * Bearer=扩展 access。主动退出时若本地无 uninstallRevokeToken，用本接口销本会话并清匹配租约。
 * 租约已指向他端 session → 只撤本会话，不动租约。
 */
authRouter.post('/extension-session-release', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  const accessToken = c.get('supabaseAccessToken')
  try {
    const result = await releaseExtensionSessionByAccessToken(c.env, userId, accessToken)
    if (!result.ok) {
      return c.json({ error: result.error }, 400)
    }
    return c.json({
      success: true,
      data: {
        revoked: result.revoked,
        clearedLease: result.clearedLease
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] extension-session-release 异常', { userId, detail: msg })
    return c.json({ error: 'session_release_failed' }, 500)
  }
})

/**
 * POST /api/auth/extension-uninstall-revoke
 *
 * 公开：body `{ token }`。消费一次性卸载 revoke token，撤销扩展 Auth session 并清租约。
 * 官网卸载页与扩展主动退出共用；**不**动官网浏览器会话。
 */
authRouter.post('/extension-uninstall-revoke', async c => {
  let token = ''
  try {
    const body = await c.req.json().catch(() => null)
    if (typeof body === 'object' && body !== null) {
      const raw = (body as { token?: unknown }).token
      if (typeof raw === 'string') {
        token = raw
      }
    }
  } catch {
    token = ''
  }

  try {
    const result = await consumeExtensionUninstallRevoke(c.env, token)
    if (!result.ok) {
      const status = result.error === 'empty_token' ? 400 : 404
      return c.json({ error: result.error }, status)
    }
    return c.json({
      success: true,
      data: {
        revoked: result.revoked,
        clearedLease: result.clearedLease
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] extension-uninstall-revoke 异常', { detail: msg })
    return c.json({ error: 'uninstall_revoke_failed' }, 500)
  }
})
