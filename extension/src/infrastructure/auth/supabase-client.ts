/**
 * 扩展侧 Supabase 公开配置（仅 url + anon key）。
 * Auth 热路径（refresh / getUser）走裸 fetch，不加载 @supabase/supabase-js，
 * 避免 Service Worker 中 GoTrue 初始化碰 `window`。
 */

/** 读取扩展构建期注入的 Supabase 公开配置。 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    return null
  }
  return { url, anonKey }
}
