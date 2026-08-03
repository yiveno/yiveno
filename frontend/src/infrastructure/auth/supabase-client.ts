import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** 读取扩展构建期注入的 Supabase 公开配置。 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    return null
  }
  return { url, anonKey }
}

/**
 * 创建无持久化的 Supabase 客户端（Service Worker 安全）。
 * 会话由扩展自行写入 chrome.storage.local。
 */
export function createExtensionSupabaseClient(accessToken?: string): SupabaseClient | null {
  const config = getSupabasePublicConfig()
  if (!config) {
    return null
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    ...(accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      : {})
  })
}
