/**
 * 认证相关类型定义
 */

/**
 * OAuth Provider 类型
 */
export type OAuthProvider = 'google' | 'microsoft' | 'github'

/**
 * OAuth Provider 配置
 */
export interface OAuthProviderConfig {
  provider: OAuthProvider
  clientId: string
  clientSecret?: string
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  scope: string
}

/**
 * OAuth Token 响应
 */
export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  id_token?: string
}

/**
 * OAuth 用户信息
 */
export interface OAuthUserInfo {
  email: string
  sub: string
  name?: string
  picture?: string
}

/**
 * JWT Payload
 */
export interface JWTPayload {
  /** Subject (用户 ID) */
  sub: string

  /** 用户邮箱 */
  email: string

  /** 订阅层级 */
  tier: string

  /** 功能权限 */
  features: Record<string, boolean>

  /** 签发时间 (Unix timestamp) */
  iat: number

  /** 过期时间 (Unix timestamp) */
  exp: number
}
