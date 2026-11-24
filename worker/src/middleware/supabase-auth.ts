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
 * verify 失败 → HTTP 状态 + 响应体（error 码不变，reason 细化）。
 * 抽成纯函数便于单测，避免 mock.module 污染其它套件。
 */
export function bodyForSupabaseAuthFailure(
  reason: 'expired' | 'invalid_token' | 'malformed_response' | 'auth_unreachable'
): { status: 401 | 503; body: { error: string; reason?: string } } {
  if (reason === 'auth_unreachable') {
    return { status: 503, body: { error: 'auth_unreachable' } }
  }
  if (reason === 'malformed_response') {
    return { status: 401, body: { error: 'invalid_token', reason: 'malformed_response' } }
  }
  if (reason === 'expired') {
    return { status: 401, body: { error: 'invalid_token', reason: 'expired' } }
  }
  return { status: 401, body: { error: 'invalid_token', reason: 'invalid' } }
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
      } else if (verified.reason === 'malformed_response') {
        warn('[SupabaseAuth] Auth 响应格式异常')
      }
      const mapped = bodyForSupabaseAuthFailure(verified.reason)
      return c.json(mapped.body, mapped.status)
    }

    c.set('supabaseUserId', verified.user.id)
    c.set('supabaseAccessToken', token)
    c.set('supabaseUserEmail', verified.user.email)
    return await next()
  }
}
