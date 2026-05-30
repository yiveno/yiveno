/**
 * Supabase 客户端 Composable
 *
 * 用于官网的 Supabase 集成
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

export const useSupabase = () => {
  const config = useRuntimeConfig()

  if (!supabaseClient) {
    const supabaseUrl = config.public.supabase.url
    const supabaseAnonKey = config.public.supabase.anonKey

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Supabase] 配置缺失')
      throw new Error('Supabase 配置缺失')
    }

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // 仅浏览器环境持久化 session，避免 SSR 访问 Web Storage。
        autoRefreshToken: true,
        persistSession: import.meta.client,
        detectSessionInUrl: import.meta.client
      }
    })
  }

  return {
    supabase: supabaseClient
  }
}

/**
 * 检查 Supabase 是否已配置
 */
export const isSupabaseConfigured = () => {
  const config = useRuntimeConfig()
  return !!(config.public.supabase.url && config.public.supabase.anonKey)
}
