/**
 * Supabase Access Token 认证中间件
 *
 * 验证扩展端传来的 Supabase session access token。
 */

import { createClient } from '@supabase/supabase-js'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'

interface SupabaseAuthEnv {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

/**
 * 从 Authorization Bearer 中解析 Supabase 用户 ID
 */
export function supabaseAuth(): MiddlewareHandler<SupabaseAuthEnv> {
  return async (c, next) => {
    const env = c.env
    const authHeader = c.req.header('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'missing_authorization' }, 401)
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      return c.json({ error: 'missing_authorization' }, 401)
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return c.json({ error: 'supabase_not_configured' }, 500)
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error || !user) {
      return c.json({ error: 'invalid_token' }, 401)
    }

    c.set('supabaseUserId', user.id)
    c.set('supabaseAccessToken', token)
    c.set('supabaseUserEmail', user.email ?? null)
    return await next()
  }
}
