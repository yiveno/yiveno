/**
 * OAuth 提供商配置
 */

import type { Env } from '../../types/env'

/** OAuth 提供商配置 */
export interface ProviderConfig {
  provider: string
  clientId: string
  clientSecret?: string
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  scope: string
}

/** 获取 OAuth 提供商配置 */
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
    if (clientSecret !== undefined) config.clientSecret = clientSecret
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
      scope: 'openid email profile User.Read'
    }
    if (clientSecret !== undefined) config.clientSecret = clientSecret
    return config
  }

  return null
}

/** 获取缺失的配置键名 */
export function missingKeys(provider: string, env: unknown, includeSecret = false): string[] {
  const envRecord = env as Record<string, unknown>
  if (provider === 'google') {
    const keys = ['AUTH_GOOGLE_CLIENT_ID']
    if (includeSecret) keys.push('AUTH_GOOGLE_CLIENT_SECRET')
    return keys.filter(k => !envRecord[k])
  }
  if (provider === 'microsoft') {
    const keys = ['AUTH_MICROSOFT_CLIENT_ID']
    if (includeSecret) keys.push('AUTH_MICROSOFT_CLIENT_SECRET')
    return keys.filter(k => !envRecord[k])
  }
  return []
}
