/**
 * Supabase Access Token 认证中间件
 *
 * 验证扩展端 / 官网传来的 Supabase session access token。
 */

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'
import { verifySupabaseAccessToken } from '../services/auth/verify-supabase-access-token'
import { warn } from '../utils/logger'

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

    const verified = await verifySupabaseAccessToken(env.SUPABASE_URL, token, {
      anonKey: env.SUPABASE_ANON_KEY
    })

    if (!verified.ok) {
      if (verified.reason === 'auth_unreachable') {
        warn('[SupabaseAuth] Auth/JWKS 不可达，优先检查本地 Node TLS 信任链')
        return c.json({ error: 'auth_unreachable' }, 503)
      }
      if (verified.reason === 'malformed_response') {
        warn('[SupabaseAuth] Auth 响应格式异常')
        return c.json({ error: 'invalid_token' }, 401)
      }
      return c.json({ error: 'invalid_token' }, 401)
    }

    c.set('supabaseUserId', verified.user.id)
    c.set('supabaseAccessToken', token)
    c.set('supabaseUserEmail', verified.user.email)
    return await next()
  }
}
