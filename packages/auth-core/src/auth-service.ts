/**
 * 认证服务 - 平台无关的核心逻辑
 *
 * 这个类封装了所有与 Supabase Auth 交互的核心逻辑
 * 可以在不同环境（Extension, Web）中复用
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AuthResponse,
  SignInCredentials,
  SignUpInfo,
  PasswordResetInfo,
  PasswordUpdateInfo,
  OAuthProvider,
  OAuthConfig
} from './types'
import { extractErrorCode, getErrorMessage } from './error-codes'
import { isEmailValid } from './validators'

export class AuthService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 邮箱密码注册
   */
  async signUp(info: SignUpInfo): Promise<AuthResponse> {
    try {
      const signUpOptions = info.redirectUrl
        ? {
            email: info.email,
            password: info.password,
            options: {
              emailRedirectTo: info.redirectUrl
            }
          }
        : {
            email: info.email,
            password: info.password
          }

      const { data, error } = await this.supabase.auth.signUp(signUpOptions)

      if (error) {
        // 检测邮箱已注册错误
        const errorCode = extractErrorCode(error)?.toLowerCase() || ''
        const errorMessage = error.message?.toLowerCase() || ''

        if (
          errorCode === 'email_already_registered' ||
          errorCode === 'email_exists' ||
          errorCode.includes('already_registered') ||
          errorMessage.includes('already registered')
        ) {
          throw new Error('该邮箱已被注册，请直接登录或使用其他邮箱')
        }

        // 检测频率限制错误
        if (errorCode === 'over_email_send_rate_limit' || errorCode.includes('rate_limit')) {
          const friendlyMessage = getErrorMessage(errorCode, '发送邮件过于频繁，请稍后再试')
          throw new Error(friendlyMessage)
        }

        // 特殊情况：邮箱格式正确但返回 invalid
        if (errorCode === 'email_address_invalid' && isEmailValid(info.email)) {
          throw new Error('该邮箱可能已被注册，请尝试登录或使用其他邮箱')
        }

        // 其他错误使用通用映射
        const friendlyMessage = getErrorMessage(
          errorCode || error.code || error.status?.toString(),
          '注册失败，请稍后重试'
        )
        throw new Error(friendlyMessage)
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('注册失败，请稍后重试')
    }
  }

  /**
   * 邮箱密码登录
   */
  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (error) {
        const errorCode = extractErrorCode(error)
        const friendlyMessage = getErrorMessage(
          errorCode || error.code || error.status?.toString(),
          '登录失败，请稍后重试'
        )
        throw new Error(friendlyMessage)
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('登录失败，请稍后重试')
    }
  }

  /**
   * OAuth 登录（获取授权 URL）
   * 注意：实际的 OAuth 流程需要在各平台中实现（因为涉及平台特定的 API）
   */
  async getOAuthUrl(provider: OAuthProvider, config: OAuthConfig): Promise<{ url: string }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: provider as 'google', // 目前仅支持 Google OAuth
        options: {
          redirectTo: config.redirectUrl,
          skipBrowserRedirect: config.skipBrowserRedirect ?? true
        }
      })

      if (error || !data.url) {
        throw new Error('获取授权 URL 失败')
      }

      return { url: data.url }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('OAuth 登录失败')
    }
  }

  /**
   * 使用 OAuth tokens 设置会话
   */
  async setOAuthSession(accessToken: string, refreshToken: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })

      if (error) {
        throw new Error(error.message || '设置会话失败')
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('设置会话失败')
    }
  }

  /**
   * 登出
   */
  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut()
    if (error) {
      throw new Error(error.message || '登出失败')
    }
  }

  /**
   * 发送密码重置邮件
   */
  async resetPassword(info: PasswordResetInfo): Promise<void> {
    const resetOptions = info.redirectUrl
      ? {
          redirectTo: info.redirectUrl
        }
      : undefined

    const { error } = await this.supabase.auth.resetPasswordForEmail(info.email, resetOptions)

    if (error) {
      const errorCode = extractErrorCode(error)
      const friendlyMessage = getErrorMessage(
        errorCode || error.code || error.status?.toString(),
        '发送重置邮件失败，请稍后重试'
      )
      throw new Error(friendlyMessage)
    }
  }

  /**
   * 更新密码
   */
  async updatePassword(info: PasswordUpdateInfo): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({
      password: info.newPassword
    })

    if (error) {
      const errorCode = extractErrorCode(error)
      const friendlyMessage = getErrorMessage(
        errorCode || error.code || error.status?.toString(),
        '更新密码失败，请稍后重试'
      )
      throw new Error(friendlyMessage)
    }
  }

  /**
   * 获取当前会话
   */
  async getSession() {
    const { data, error } = await this.supabase.auth.getSession()
    if (error) {
      throw new Error(error.message || '获取会话失败')
    }
    return {
      user: data.session?.user ?? null,
      session: data.session
    }
  }

  /**
   * 获取当前用户
   */
  async getUser() {
    const { data, error } = await this.supabase.auth.getUser()
    if (error) {
      throw new Error(error.message || '获取用户失败')
    }
    return data.user
  }
}
