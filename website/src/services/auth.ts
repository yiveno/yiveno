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

export async function signInWithOAuth(provider: 'google' | 'microsoft') {
  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: providerMap[provider],
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = await getSupabase()
  await supabase.auth.signOut()
}

export function onAuthStateChange(callback: (event: string, userId?: string) => void) {
  void getSupabase().then(supabase => {
    supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      callback(event, session?.user?.id)
    })
  })
}
