import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_CLIENT_KEY = '__yiveno_supabase_client__'

type WindowWithSupabase = Window & {
  [SUPABASE_CLIENT_KEY]?: SupabaseClient
}

// 动态导入 supabase-js，避免 Astro/Vite SSR 下的初始化问题
let supabaseClientPromise: Promise<SupabaseClient> | null = null

export async function getSupabase(): Promise<SupabaseClient> {
  if (typeof window !== 'undefined') {
    const existing = (window as WindowWithSupabase)[SUPABASE_CLIENT_KEY]
    if (existing) {
      return existing
    }
  }

  if (!supabaseClientPromise) {
    supabaseClientPromise = (async () => {
      const mod = await import('@supabase/supabase-js')
      const SUPABASE_URL =
        import.meta.env.PUBLIC_SUPABASE_URL || 'https://ugxgxytykxblctsyulsg.supabase.co'
      const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

      if (!SUPABASE_ANON_KEY) {
        throw new Error('PUBLIC_SUPABASE_ANON_KEY 未配置')
      }

      const client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

      if (typeof window !== 'undefined') {
        ;(window as WindowWithSupabase)[SUPABASE_CLIENT_KEY] = client
      }

      return client
    })()
  }

  return supabaseClientPromise
}
