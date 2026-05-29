/**
 * 认证核心类型定义
 */

import type { User, Session } from '@supabase/supabase-js'

/**
 * OAuth 提供商
 */
export type OAuthProvider = 'google' | 'microsoft'

/**
 * 认证响应
 */
export interface AuthResponse {
  success: boolean
  user?: User | null
  session?: Session | null
  message?: string
}

/**
 * 登录凭证
 */
export interface SignInCredentials {
  email: string
  password: string
}

/**
 * 注册信息
 */
export interface SignUpInfo {
  email: string
  password: string
  redirectUrl?: string
}

/**
 * 密码重置信息
 */
export interface PasswordResetInfo {
  email: string
  redirectUrl?: string
}

/**
 * 密码更新信息
 */
export interface PasswordUpdateInfo {
  newPassword: string
}

/**
 * OAuth 配置
 */
export interface OAuthConfig {
  redirectUrl: string
  skipBrowserRedirect?: boolean
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean
  message?: string
}
