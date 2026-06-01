import { getSupabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

export async function getSession(): Promise<Session | null> {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signInWithOAuth(provider: 'google' | 'microsoft') {
  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
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
  getSupabase().then((supabase: any) => {
    supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      callback(event, session?.user?.id)
    })
  })
}
