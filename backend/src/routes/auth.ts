/**
 * 认证路由
 *
 * - 遗留：自建 OAuth → 自定义 JWT（非 Phase C 主路径）
 * - Phase C：`POST /extension-session` 为扩展铸造独立 Supabase 会话（官网 Bearer）
 * - `POST /extension-uninstall-revoke`：卸载落地页 / 主动退出用一次性 token 销扩展会话
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleAuthProviders, handleAuthStart, handleAuthCallback } from '../handlers/auth'
import { supabaseAuth } from '../middleware/supabase-auth'
import { consumeExtensionUninstallRevoke } from '../services/auth/consume-extension-uninstall-revoke'
import { mintExtensionSession } from '../services/auth/mint-extension-session'
import { error as logErrorMessage, info } from '../utils/logger'

type AuthVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
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
 * POST /api/auth/extension-session
 *
 * 为 Chrome 扩展铸造独立 session；扩展侧单活跃。
 * Body（可选）：`{ confirmDisplace?: boolean }` — 确认挤掉其它扩展会话。
 * 409 `needs_displace_confirm`：KV 登记已有扩展会话且未确认。
 */
authRouter.post('/extension-session', supabaseAuth(), async c => {
  const userId = c.get('supabaseUserId')
  const email = c.get('supabaseUserEmail')
  let confirmDisplace = false
  let extensionId: string | undefined
  try {
    const body = await c.req.json().catch(() => null)
    if (typeof body === 'object' && body !== null) {
      if ((body as { confirmDisplace?: unknown }).confirmDisplace === true) {
        confirmDisplace = true
      }
      const rawExt = (body as { extensionId?: unknown }).extensionId
      if (typeof rawExt === 'string' && rawExt.trim()) {
        extensionId = rawExt.trim()
      }
    }
  } catch {
    confirmDisplace = false
  }

  try {
    const result = await mintExtensionSession(c.env, userId, email, {
      confirmDisplace,
      ...(extensionId ? { extensionId } : {})
    })
    if (!result.ok) {
      if (result.error === 'needs_displace_confirm') {
        info('[Auth] extension-session 需确认挤掉', { userId })
        return c.json(
          {
            error: 'needs_displace_confirm',
            data: {
              existingMintedAt: result.existingMintedAt ?? null
            }
          },
          409
        )
      }
      const status =
        result.error === 'supabase_not_configured'
          ? 500
          : result.error === 'email_required'
            ? 400
            : 502
      logErrorMessage('[Auth] extension-session 铸造失败', { userId, error: result.error })
      return c.json({ error: result.error }, status)
    }
    info('[Auth] extension-session 已返回', {
      userId,
      displaced: Boolean(result.displacedSessionId),
      hasUninstallRevokeToken: Boolean(result.session.uninstallRevokeToken)
    })
    return c.json({
      success: true,
      data: {
        accessToken: result.session.accessToken,
        refreshToken: result.session.refreshToken,
        userId: result.session.userId,
        email: result.session.email,
        expiresAt: result.session.expiresAt,
        displaced: Boolean(result.displacedSessionId),
        uninstallRevokeToken: result.session.uninstallRevokeToken
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Auth] extension-session 异常', { userId, detail: msg })
    return c.json({ error: 'extension_session_failed' }, 500)
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
