import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_CLIENT_KEY = '__yiveno_supabase_client__'

type WindowWithSupabase = Window & {
  [SUPABASE_CLIENT_KEY]?: SupabaseClient
}

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
      const SUPABASE_URL =
        import.meta.env.PUBLIC_SUPABASE_URL || 'https://ugxgxytykxblctsyulsg.supabase.co'
      const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

      if (!SUPABASE_ANON_KEY) {
        throw new Error('PUBLIC_SUPABASE_ANON_KEY 未配置')
      }

      /**
       * 官网是纯客户端 OAuth：沿用 JS 默认 implicit（回调 #access_token=）。
       * detectSessionInUrl 关闭，由 AuthCallback 显式处理，避免与手动解析竞态/误抛。
       */
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true
        }
      })

      if (typeof window !== 'undefined') {
        ;(window as WindowWithSupabase)[SUPABASE_CLIENT_KEY] = client
      }

      return client
    })()
  }

  return supabaseClientPromise
}
