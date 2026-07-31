/**
 * 认证处理器
 *
 * 负责 OAuth 认证流程（Google、Microsoft）
 */

import type { Env } from '../types/env'
import { okJson, errorJson } from '../utils/response'
import { parseAllowlist } from '../utils/validation'
import { signJWT } from '../utils/jwt'
import { getProviderConfig } from '../services/auth/provider-config'
import { exchangeCodeForToken, fetchUserInfoWithAccessToken } from '../services/auth/oauth-client'
import { validateStartParams, validateCallbackRequest } from '../services/auth/validation'
import { logError } from '../utils/logger'

export { getProviderConfig } from '../services/auth/provider-config'

/** GET /api/auth/start — 开始 OAuth 认证流程 */
export function handleAuthStart(request: Request, env: Env, origin: string | null): Response {
  try {
    const url = new URL(request.url)
    const provider = (url.searchParams.get('provider') || 'google').toLowerCase()
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const codeChallenge = url.searchParams.get('code_challenge') || ''
    const scope = url.searchParams.get('scope') || ''

    const validation = validateStartParams(redirectUri, provider, env, origin)
    if (validation) return validation

    const cfg = getProviderConfig(provider, env)!
    // OAuth state 必须用 CSPRNG，禁止 Math.random（可预测）
    const state = url.searchParams.get('state') || crypto.randomUUID()
    const authUrl = new URL(cfg.authUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', cfg.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    if (codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
    }
    authUrl.searchParams.set('scope', scope || cfg.scope || '')
    authUrl.searchParams.set('state', state)
    if (provider === 'google') {
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('access_type', 'offline')
    }

    return okJson({ success: true, provider, authUrl: authUrl.toString(), state }, origin)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError(err, { path: '/api/auth/start', detail: msg })
    return errorJson({ error: 'auth_start_failed' }, 500, origin)
  }
}

/** GET /api/auth/callback — OAuth 认证回调 */
export async function handleAuthCallback(
  request: Request,
  env: Env,
  origin: string | null
): Promise<Response> {
  try {
    const url = new URL(request.url)
    const provider = (url.searchParams.get('provider') || 'google').toLowerCase()
    const code = url.searchParams.get('code') || ''
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const codeVerifier = url.searchParams.get('code_verifier') || ''

    const cbValidation = validateCallbackRequest(code, provider, redirectUri, env, origin)
    if (cbValidation) return cbValidation

    const cfg = getProviderConfig(provider, env)!
    const accessToken = await exchangeCodeForToken(cfg, code, redirectUri, codeVerifier)
    const { email, sub } = await fetchUserInfoWithAccessToken(provider, cfg, accessToken)

    const subject = sub || email
    if (!subject) {
      return errorJson({ error: 'missing_user_identity' }, 502, origin)
    }
    const userId = `${provider}:${subject}`
    const tier = 'free'
    const secret = env.JWT_SECRET || env.SECRET
    if (!secret) {
      return errorJson({ error: 'JWT_SECRET 未配置' }, 500, origin)
    }
    const token = await signJWT(
      secret,
      { sub: userId, email, tier, features: {} },
      7 * 24 * 60 * 60
    )

    return okJson(
      {
        success: true,
        token,
        user: { id: userId, email, provider, tier }
      },
      origin
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // 对外稳定错误码，上游细节只打日志
    logError(err, { path: '/api/auth/callback', detail: msg })
    return errorJson({ error: 'auth_callback_failed' }, 500, origin)
  }
}

/** GET /api/auth/providers — 获取可用的 OAuth 提供商列表 */
export function handleAuthProviders(_request: Request, env: Env, origin: string | null): Response {
  try {
    const gCfg = getProviderConfig('google', env)
    const msCfg = getProviderConfig('microsoft', env)
    const google = Boolean(gCfg)
    const microsoft = Boolean(msCfg)
    const googleHasSecret = Boolean(gCfg && gCfg.clientSecret)
    const microsoftHasSecret = Boolean(msCfg && msCfg.clientSecret)
    const allow = parseAllowlist(env)

    return okJson(
      {
        success: true,
        providers: { google, googleHasSecret, microsoft, microsoftHasSecret },
        redirectAllowlist: allow.length ? allow : undefined,
        note: '默认放行 https://*.chromiumapp.org 作为 Chrome 扩展回调域'
      },
      origin
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError(err, { path: '/api/auth/providers', detail: msg })
    return errorJson({ error: 'auth_providers_failed' }, 500, origin)
  }
}
