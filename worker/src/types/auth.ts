/**
 * 认证相关类型定义
 */

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
