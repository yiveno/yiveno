/**
 * 过渡期双栈鉴权：`ydt_` 前缀走 deviceAuth，否则走 supabaseAuth。
 */

import type { Context, MiddlewareHandler, Next } from 'hono'
import type { Env } from '../types/env'
import { DEVICE_TOKEN_PREFIX } from '../services/auth/device-token-kv'
import { deviceAuth } from './device-auth'
import { supabaseAuth } from './supabase-auth'

interface DualAuthEnv {
  Bindings: Env
  Variables: {
    deviceUserId?: string
    deviceIsAnonymous: boolean
    deviceId?: string
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

/**
 * Bearer 以 `ydt_` 开头 → 设备 token；否则 → Supabase JWT。
 */
export function deviceAuthOrSupabaseAuth(): MiddlewareHandler<DualAuthEnv> {
  const device = deviceAuth()
  const supabase = supabaseAuth()

  return async (c, next) => {
    const authHeader = c.req.header('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'missing_authorization' }, 401)
    }
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      return c.json({ error: 'missing_authorization' }, 401)
    }

    // 子中间件 Variables 与 Dual 不完全同构；运行时字段兼容，此处收窄调用
    const asAny = c as Context

    if (token.startsWith(DEVICE_TOKEN_PREFIX)) {
      return device(asAny, next as Next)
    }

    c.set('deviceIsAnonymous', false)
    return supabase(asAny, next as Next)
  }
}
