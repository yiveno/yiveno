import type { SupabaseClient } from '@supabase/supabase-js'

// 动态导入 supabase-js，避免 Astro/Vite SSR 下的初始化问题
let supabaseClientPromise: Promise<SupabaseClient> | null = null

export async function getSupabase(): Promise<SupabaseClient> {
  if (supabaseClientPromise) return supabaseClientPromise

  const mod = await import('@supabase/supabase-js')
  const SUPABASE_URL =
    import.meta.env.PUBLIC_SUPABASE_URL || 'https://ugxgxytykxblctsyulsg.supabase.co'
  const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_ANON_KEY) {
    throw new Error('PUBLIC_SUPABASE_ANON_KEY 未配置')
  }

  supabaseClientPromise = Promise.resolve(mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
  return supabaseClientPromise
}
