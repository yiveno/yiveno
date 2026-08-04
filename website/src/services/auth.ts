import type { Provider, Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

const providerMap: Record<'google' | 'microsoft', Provider> = {
  google: 'google',
  microsoft: 'azure'
}

export async function getSession(): Promise<Session | null> {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** 清除本地 Supabase 会话（换账号前调用） */
export async function signOut(): Promise<void> {
  const supabase = await getSupabase()
  const { error } = await supabase.auth.signOut()
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
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        prompt: 'select_account'
      },
      ...(scopes ? { scopes } : {})
    }
  })
  if (error) throw error
  return data
}
