/**
 * 认证处理器
 *
 * 负责 OAuth 认证流程（Google、Microsoft）
 */

import type { Env } from '../types/env'
import type { OAuthTokenResponse, OAuthUserInfo } from '../types/auth'
import { okJson, errorJson } from '../utils/response'
import { parseAllowlist, isAllowedRedirectUri } from '../utils/validation'
import { signJWT } from '../utils/jwt'

/**
 * OAuth 提供商配置
 */
interface ProviderConfig {
  provider: string
  clientId: string
  clientSecret?: string
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  scope: string
}

/**
 * 获取 OAuth 提供商配置
 *
 * @param provider - 提供商名称（google/microsoft）
 * @param env - 环境变量
 * @returns 提供商配置或 null
 */
export function getProviderConfig(provider: string, env: Env): ProviderConfig | null {
  if (provider === 'google') {
    const clientId = env.AUTH_GOOGLE_CLIENT_ID
    const clientSecret = env.AUTH_GOOGLE_CLIENT_SECRET
    const authUrl = env.AUTH_GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth'
    const tokenUrl = env.AUTH_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token'
    const userInfoUrl =
      env.AUTH_GOOGLE_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo'
    if (!clientId) return null

    const config: ProviderConfig = {
      provider,
      clientId,
      authUrl,
      tokenUrl,
      userInfoUrl,
      scope: 'openid email profile'
    }
    if (clientSecret) {
      config.clientSecret = clientSecret
    }
    return config
  }
  if (provider === 'microsoft') {
    const clientId = env.AUTH_MICROSOFT_CLIENT_ID
    const clientSecret = env.AUTH_MICROSOFT_CLIENT_SECRET
    const authUrl =
      env.AUTH_MICROSOFT_AUTH_URL ||
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    const tokenUrl =
      env.AUTH_MICROSOFT_TOKEN_URL || 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    const userInfoUrl = env.AUTH_MICROSOFT_USERINFO_URL || 'https://graph.microsoft.com/v1.0/me'
    if (!clientId) return null

    const config: ProviderConfig = {
      provider,
      clientId,
      authUrl,
      tokenUrl,
      userInfoUrl,
      scope: 'openid email profile'
    }
    if (clientSecret) {
      config.clientSecret = clientSecret
    }
    return config
  }
  return null
}

/**
 * 处理认证提供商列表请求
 *
 * @param _request - 请求对象
 * @param env - 环境变量
 * @param origin - 请求来源
 * @returns 提供商列表响应
 */
export function handleAuthProviders(_request: Request, env: Env, origin: string | null): Response {
  try {
    const gCfg = getProviderConfig('google', env)
    const google = Boolean(gCfg)
    const googleHasSecret = Boolean(gCfg && gCfg.clientSecret)
    const msCfg = getProviderConfig('microsoft', env)
    const microsoft = Boolean(msCfg)
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
    return errorJson({ error: msg }, 500, origin)
  }
}

/**
 * 处理认证开始请求
 *
 * @param request - 请求对象
 * @param env - 环境变量
 * @param origin - 请求来源
 * @returns 认证 URL 响应
 */
export function handleAuthStart(request: Request, env: Env, origin: string | null): Response {
  try {
    const url = new URL(request.url)
    const provider = (url.searchParams.get('provider') || 'google').toLowerCase()
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const codeChallenge = url.searchParams.get('code_challenge') || ''
    const scope = url.searchParams.get('scope') || ''
    if (!redirectUri) return errorJson({ error: 'missing redirect_uri' }, 400, origin)
    const redirCheck = isAllowedRedirectUri(redirectUri, env)
    if (!redirCheck.ok)
      return errorJson({ error: `invalid redirect_uri: ${redirCheck.error}` }, 400, origin)
    if (!['google', 'microsoft'].includes(provider)) {
      return errorJson({ error: `unsupported provider: ${provider}` }, 400, origin)
    }
    const cfg = getProviderConfig(provider, env)
    if (!cfg) {
      const envRecord = env as unknown as Record<string, unknown>
      const missing =
        provider === 'google'
          ? ['AUTH_GOOGLE_CLIENT_ID'].filter(k => !envRecord[k])
          : provider === 'microsoft'
            ? ['AUTH_MICROSOFT_CLIENT_ID'].filter(k => !envRecord[k])
            : []
      return errorJson({ error: `provider not configured: ${provider}`, missing }, 400, origin)
    }
    const state = url.searchParams.get('state') || Math.random().toString(36).slice(2)
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
    return okJson(
      {
        success: true,
        provider,
        authUrl: authUrl.toString(),
        state
      },
      origin
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500, origin)
  }
}

/**
 * 处理认证回调请求
 *
 * @param request - 请求对象
 * @param env - 环境变量
 * @param origin - 请求来源
 * @returns JWT token 响应
 */
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
    if (!code) return errorJson({ error: 'missing code' }, 400, origin)
    if (!['google', 'microsoft'].includes(provider)) {
      return errorJson({ error: `unsupported provider: ${provider}` }, 400, origin)
    }
    const cfg = getProviderConfig(provider, env)
    if (!cfg) {
      const envRecord = env as unknown as Record<string, unknown>
      const missing =
        provider === 'google'
          ? ['AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET'].filter(k => !envRecord[k])
          : provider === 'microsoft'
            ? ['AUTH_MICROSOFT_CLIENT_ID', 'AUTH_MICROSOFT_CLIENT_SECRET'].filter(
                k => !envRecord[k]
              )
            : []
      return errorJson({ error: `provider not configured: ${provider}`, missing }, 400, origin)
    }
    if (!redirectUri) return errorJson({ error: 'missing redirect_uri' }, 400, origin)
    const redirCheck = isAllowedRedirectUri(redirectUri, env)
    if (!redirCheck.ok)
      return errorJson({ error: `invalid redirect_uri: ${redirCheck.error}` }, 400, origin)
    if (!codeVerifier) return errorJson({ error: 'missing code_verifier' }, 400, origin)
    const accessToken = await exchangeCodeForToken(cfg, code, redirectUri, codeVerifier)
    const { email, sub } = await fetchUserInfoWithAccessToken(provider, cfg, accessToken)
    const userId = `${provider}:${sub || email || Math.random().toString(36).slice(2)}`
    const tier = 'free'
    const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
    const token = await signJWT(
      secret,
      { sub: userId, email, tier, features: {} },
      7 * 24 * 60 * 60
    )
    const now = Math.floor(Date.now() / 1000)
    return okJson(
      {
        success: true,
        token,
        tier,
        user: { id: userId, email },
        expiresAt: now + 7 * 24 * 60 * 60
      },
      origin
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500, origin)
  }
}

/**
 * 使用授权码交换访问令牌
 *
 * @param cfg - 提供商配置
 * @param code - 授权码
 * @param redirectUri - 重定向 URI
 * @param codeVerifier - PKCE code verifier
 * @returns 访问令牌
 */
async function exchangeCodeForToken(
  cfg: ProviderConfig,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<string> {
  const form = new globalThis.URLSearchParams()
  form.set('grant_type', 'authorization_code')
  form.set('code', code)
  form.set('redirect_uri', redirectUri)
  form.set('client_id', cfg.clientId)
  form.set('code_verifier', codeVerifier)
  if (cfg.clientSecret) form.set('client_secret', cfg.clientSecret)
  const tokenResp = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: form.toString()
  })
  if (!tokenResp.ok) {
    let detail = ''
    try {
      detail = await tokenResp.text()
    } catch {
      /* ignore */
    }
    throw new Error(
      `token exchange failed ${tokenResp.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    )
  }
  const tokenJson = (await tokenResp.json().catch(
    (): OAuthTokenResponse => ({
      access_token: '',
      token_type: 'Bearer'
    })
  )) as OAuthTokenResponse
  const accessToken = tokenJson.access_token
  if (!accessToken) throw new Error('missing access_token')
  return accessToken
}

/**
 * 使用访问令牌获取用户信息
 *
 * @param provider - 提供商名称
 * @param cfg - 提供商配置
 * @param accessToken - 访问令牌
 * @returns 用户信息
 */
async function fetchUserInfoWithAccessToken(
  provider: string,
  cfg: ProviderConfig,
  accessToken: string
): Promise<OAuthUserInfo> {
  if (provider === 'google') {
    const uResp = await fetch(cfg.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const rawData = await uResp.json().catch(() => ({}))
    const u = rawData as Partial<OAuthUserInfo>
    return { email: String(u.email || ''), sub: String(u.sub || '') }
  }
  if (provider === 'github') {
    const uResp = await fetch(cfg.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'user-agent': 'AcuityBookmarks'
      }
    })
    const u: Record<string, unknown> = (await uResp.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    let email = String(u.email || '')
    const sub = String(u.id || '')
    if (!email) {
      try {
        const eResp = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            accept: 'application/json',
            'user-agent': 'AcuityBookmarks'
          }
        })
        const arr = await eResp.json().catch(() => [])
        if (Array.isArray(arr) && arr.length) {
          const primary = arr.find((x: Record<string, unknown>) => x && x.primary) || arr[0]
          if (primary && typeof primary === 'object' && 'email' in primary) {
            email = String(primary.email)
          }
        }
      } catch (e) {
        console.error('fetchUserInfoWithAccessToken failed', e)
      }
    }
    return { email, sub }
  }
  if (provider === 'microsoft') {
    const uResp = await fetch(cfg.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const rawData = await uResp.json().catch(() => ({}))
    const u = rawData as Partial<OAuthUserInfo>
    return { email: String(u.email || ''), sub: String(u.sub || '') }
  }
  return { email: '', sub: '' }
}
