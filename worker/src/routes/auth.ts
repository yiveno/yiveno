/**
 * 认证路由
 *
 * - 遗留：自建 OAuth → 自定义 JWT（非 Phase C 主路径）
 * - D 方案：`POST /device-register` 发设备 token；设备列表 / 撤销 / 改名；`POST /device-revoke-self`
 * - 旧 `POST /extension-session` → 410（设计 §2.1 推荐 ②）
 * - `POST /website-session`：扩展双栈 Bearer 为官网铸造独立会话
 * - uninstall-revoke：一次性票撤 device token（payload={userId,deviceId}）
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleAuthProviders, handleAuthStart, handleAuthCallback } from '../handlers/auth'
import { deviceAuth, invalidateDeviceAuthCacheEntry } from '../middleware/device-auth'
import { deviceAuthOrSupabaseAuth } from '../middleware/device-or-supabase-auth'
import { supabaseAuth } from '../middleware/supabase-auth'
import { consumeExtensionUninstallRevoke } from '../services/auth/consume-extension-uninstall-revoke'
import { handleDeviceRegister } from '../services/auth/device-register'
import {
  DEVICE_LABEL_MAX_LEN,
  listDevicesForUser,
  renameDeviceById,
  revokeDeviceById,
  revokeDeviceTokenSelf
} from '../services/auth/device-token-kv'
import { mintWebsiteSessionFromExtension } from '../services/auth/mint-website-session'
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
 * GET /api/auth/devices
 *
 * 官网账户页设备列表。鉴权：官网 Supabase JWT（设计 §2.3；AccountPage 持官网会话）。
 * 索引漂移 id 不返回（逐个核对 `devtok:`）。
 */
authRouter.get('/devices', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  try {
    const result = await listDevicesForUser(c.env, userId)
    if (!result.ok) {
      return c.json({ error: result.error }, 503)
    }
    return c.json({ success: true, data: { devices: result.devices } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] devices 列表异常', { userId, detail: msg })
    return c.json({ error: 'devices_list_failed' }, 500)
  }
})

/**
 * POST /api/auth/device-revoke
 *
 * 官网撤销指定设备（body `{ deviceId }`）。仅限本用户；含撤销自身。
 * 不存在 / 非本人 → 404（不泄露归属）。
 */
authRouter.post('/device-revoke', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  let deviceId = ''
  try {
    const body = await c.req.json().catch(() => null)
    if (typeof body === 'object' && body !== null) {
      const raw = (body as { deviceId?: unknown }).deviceId
      if (typeof raw === 'string') deviceId = raw
    }
  } catch {
    deviceId = ''
  }
  if (!deviceId.trim()) {
    return c.json({ error: 'missing_device_id' }, 400)
  }
  try {
    const result = await revokeDeviceById(c.env, userId, deviceId)
    if (!result.ok) {
      return c.json({ error: result.error }, 503)
    }
    if (!result.revoked) {
      return c.json({ error: 'not_found' }, 404)
    }
    invalidateDeviceAuthCacheEntry(result.deviceToken)
    info('[Auth] device-revoke', { userId, deviceId: deviceId.trim() })
    return c.json({ success: true, data: { revoked: true } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] device-revoke 异常', { userId, detail: msg })
    return c.json({ error: 'device_revoke_failed' }, 500)
  }
})

/**
 * POST /api/auth/device-rename
 *
 * 改设备名（body `{ deviceId, name }`）；trim 后空或超 64 → 400。
 */
authRouter.post('/device-rename', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  let deviceId = ''
  let name = ''
  try {
    const body = await c.req.json().catch(() => null)
    if (typeof body === 'object' && body !== null) {
      const rawId = (body as { deviceId?: unknown }).deviceId
      const rawName = (body as { name?: unknown }).name
      if (typeof rawId === 'string') deviceId = rawId
      if (typeof rawName === 'string') name = rawName
    }
  } catch {
    deviceId = ''
    name = ''
  }
  if (!deviceId.trim()) {
    return c.json({ error: 'missing_device_id' }, 400)
  }
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName.length > DEVICE_LABEL_MAX_LEN) {
    return c.json({ error: 'invalid_name' }, 400)
  }
  try {
    const result = await renameDeviceById(c.env, userId, deviceId, trimmedName)
    if (!result.ok) {
      if (result.error === 'invalid_name') {
        return c.json({ error: 'invalid_name' }, 400)
      }
      return c.json({ error: result.error }, 503)
    }
    if ('notFound' in result && result.notFound) {
      return c.json({ error: 'not_found' }, 404)
    }
    if (!('device' in result)) {
      return c.json({ error: 'not_found' }, 404)
    }
    info('[Auth] device-rename', { userId, deviceId: deviceId.trim() })
    return c.json({ success: true, data: { device: result.device } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] device-rename 异常', { userId, detail: msg })
    return c.json({ error: 'device_rename_failed' }, 500)
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
 * POST /api/auth/website-session
 *
 * Bearer=扩展 access 或 device token。为官网铸造独立会话（反向接通）。
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
 * POST /api/auth/extension-uninstall-revoke
 *
 * 公开：body `{ token }`。消费一次性卸载票 → 撤对应 device token。
 * **不**动官网浏览器会话。
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
    if (result.deviceToken) {
      invalidateDeviceAuthCacheEntry(result.deviceToken)
    }
    return c.json({
      success: true,
      data: {
        revoked: result.revoked
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] extension-uninstall-revoke 异常', { detail: msg })
    return c.json({ error: 'uninstall_revoke_failed' }, 500)
  }
})
