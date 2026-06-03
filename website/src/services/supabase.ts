// 动态导入 supabase-js，避免 Astro/Vite SSR 下的初始化问题
let supabaseClient: any = null

export async function getSupabase(): Promise<any> {
  if (supabaseClient) return supabaseClient
  const mod = await import('@supabase/supabase-js')
  const SUPABASE_URL =
    import.meta.env.PUBLIC_SUPABASE_URL || 'https://ugxgxytykxblctsyulsg.supabase.co'
  const SUPABASE_ANON_KEY =
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneGd4eXR5a3hibGN0c3l1bHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU3MDg2NTIsImV4cCI6MjA0MTI4NDY1Mn0.hDOiB2xv7fUT_yx6n6_S9qVtd4zH5LQU0aFgQDmp5aM'
  supabaseClient = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return supabaseClient
}
