import type { SupabaseClient } from '@supabase/supabase-js'

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
 *
 * 动态 import：避免 `@supabase/supabase-js` 静态打进 background 冷启动包；
 * 仅登录 / 刷新会话 / 拉资料时加载。
 */
export async function createExtensionSupabaseClient(
  accessToken?: string
): Promise<SupabaseClient | null> {
  const config = getSupabasePublicConfig()
  if (!config) {
    return null
  }

  const { createClient } = await import('@supabase/supabase-js')
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
