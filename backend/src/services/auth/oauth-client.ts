/**
 * OAuth 令牌交换 & 用户信息获取
 */

import type { OAuthTokenResponse, OAuthUserInfo } from '../../types/auth'
import type { ProviderConfig } from './provider-config'

/** 使用授权码交换访问令牌 */
export async function exchangeCodeForToken(
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

  const tokenJson = (await tokenResp
    .json()
    .catch(
      (): OAuthTokenResponse => ({ access_token: '', token_type: 'Bearer' })
    )) as OAuthTokenResponse

  if (!tokenJson.access_token) throw new Error('missing access_token')
  return tokenJson.access_token
}

/** 使用访问令牌获取用户信息 */
export async function fetchUserInfoWithAccessToken(
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
    return fetchGitHubUserInfo(cfg.userInfoUrl, accessToken)
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

/** 获取 GitHub 用户信息（含邮箱回退） */
async function fetchGitHubUserInfo(
  userInfoUrl: string,
  accessToken: string
): Promise<OAuthUserInfo> {
  const uResp = await fetch(userInfoUrl, {
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
    email = await fetchGitHubPrimaryEmail(accessToken)
  }
  return { email, sub }
}

/** 获取 GitHub 主邮箱 */
async function fetchGitHubPrimaryEmail(accessToken: string): Promise<string> {
  const eResp = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'user-agent': 'AcuityBookmarks'
    }
  })
  const arr = await eResp.json().catch(() => [])
  if (!Array.isArray(arr) || !arr.length) return ''
  const primary = arr.find((x: Record<string, unknown>) => x && x.primary) || arr[0]
  if (primary && typeof primary === 'object' && 'email' in primary) {
    return String(primary.email)
  }
  return ''
}
