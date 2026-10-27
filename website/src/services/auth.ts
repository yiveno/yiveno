import type { Provider, Session } from '@supabase/supabase-js'
import { isValidEmail, normalizeEmail, normalizeOtpCode } from './auth-email'
import { getSupabase } from './supabase'

const providerMap: Record<'google' | 'microsoft', Provider> = {
  google: 'google',
  microsoft: 'azure'
}

/** 官网登录回调（OAuth / 邮件 magic link 共用）。 */
function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}

export async function getSession(): Promise<Session | null> {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * 清除**本浏览器**官网 Supabase 会话。
 * 使用 `local`：不撤销其它设备 / 扩展已铸造的独立 refresh。
 * **不**通知扩展退登（官网退出 ≠ 扩展退出；UI 桥只推 `website_auth_changed`）。
 */
export async function signOut(): Promise<void> {
  const supabase = await getSupabase()
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export async function signInWithOAuth(provider: 'google' | 'microsoft') {
  const supabase = await getSupabase()
  /**
   * Azure：Supabase 强制要求 email；官方文档要求 scopes 含 `email`，
   * 否则回调报 Error getting user email from external provider。
   * @see https://supabase.com/docs/guides/auth/social-login/auth-azure
   *
   * prompt=select_account：每次弹出账号选择，避免 Google/Microsoft 静默沿用上次账号。
   */
  const scopes = provider === 'microsoft' ? 'email openid profile offline_access' : undefined
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: providerMap[provider],
    options: {
      redirectTo: authCallbackUrl(),
      queryParams: {
        prompt: 'select_account'
      },
      ...(scopes ? { scopes } : {})
    }
  })
  if (error) throw error
  return data
}

/**
 * 向邮箱发送登录 OTP（及模板中的 magic link，若已配置）。
 * 成功后须由用户输入邮件中的验证码，再调 `verifyEmailOtp`；
 * 若用户点邮件内链接，则落 `/auth/callback`（与 OAuth 同收尾）。
 *
 * 运维前提：Supabase Auth → Email 已启用；邮件模板含 `{{ .Token }}`；
 * 生产建议自建 SMTP（大陆投递）。
 */
export async function signInWithEmailOtp(
  rawEmail: string,
  captchaToken?: string
): Promise<{ email: string }> {
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email)) {
    throw new Error('Enter a valid email address.')
  }
  const token = captchaToken?.trim() || ''
  if (!token) {
    throw new Error('Complete the bot check before requesting a code.')
  }
  const supabase = await getSupabase()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: authCallbackUrl(),
      shouldCreateUser: true,
      captchaToken: token
    }
  })
  if (error) throw error
  return { email }
}

/**
 * 校验邮件 OTP，在本页建立官网 session（不离开 `/login`）。
 * 成功后调用方按 connect / next /account 收尾（与 OAuth 回调同优先级）。
 */
export async function verifyEmailOtp(rawEmail: string, rawToken: string): Promise<Session> {
  const email = normalizeEmail(rawEmail)
  const token = normalizeOtpCode(rawToken)
  if (!isValidEmail(email)) {
    throw new Error('Enter a valid email address.')
  }
  if (token.length < 6) {
    throw new Error('Enter the 6-digit code from your email.')
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  })
  if (error) throw error
  if (!data.session?.user?.id) {
    throw new Error('Sign-in did not finish. Please try again.')
  }
  return data.session
}

/** 将 GoTrue / 网络错误压成登录页可读短句（细节打 console）。 */
export function mapAuthUserError(
  err: unknown,
  fallback = 'Sign-in failed. Please try again.'
): string {
  const message = err instanceof Error ? err.message : String(err || '')
  const lower = message.toLowerCase()
  if (!message) return fallback
  // captcha_failed 等含 token 字样，须先于 OTP 文案匹配
  if (lower.includes('captcha')) {
    return 'Bot check failed. Refresh and try again, or use Google / Microsoft.'
  }
  if (
    lower.includes('error sending') ||
    lower.includes('sending magic link') ||
    lower.includes('unexpected_failure')
  ) {
    return "We couldn't send the email right now. Try again in a minute, or use Google / Microsoft."
  }
  if (lower.includes('rate limit') || lower.includes('security purposes')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (
    lower.includes('otp_expired') ||
    lower.includes('otp_disabled') ||
    lower.includes('token has expired') ||
    lower.includes('token is invalid') ||
    lower.includes('invalid otp') ||
    lower.includes('expired otp')
  ) {
    return 'That code is invalid or expired. Request a new one.'
  }
  if (lower.includes('valid email') || lower.includes('email address')) {
    return message
  }
  console.warn('[auth] provider error', message)
  return fallback
}
