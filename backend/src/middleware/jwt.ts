/**
 * JWT 认证中间件
 *
 * 使用 Hono 的 JWT 中间件验证 JWT token
 */

import { jwt } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'

/**
 * JWT 认证中间件工厂函数
 *
 * 注意：由于 Hono JWT 中间件的 secret 参数不支持动态获取，
 * 这里使用默认密钥。在生产环境中，应该在应用启动时设置环境变量。
 *
 * @returns JWT 中间件
 *
 * @example
 * ```typescript
 * // 在路由中使用
 * app.use('/api/admin/*', jwtAuth())
 * ```
 */
export function jwtAuth(): MiddlewareHandler {
  // 使用默认密钥，实际密钥应该从环境变量获取
  // 在 Cloudflare Worker 中，环境变量在运行时可用
  return async (c, next) => {
    const env = c.env as Env
    const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'

    // 创建 JWT 中间件实例
    const jwtMiddleware = jwt({
      secret,
      alg: 'HS256'
    })

    // 执行 JWT 验证
    return jwtMiddleware(c, next)
  }
}

/**
 * JWT Payload 类型
 */
export interface JWTPayload {
  sub: string // 用户 ID（格式：provider:id）
  email: string // 用户邮箱
  tier: string // 订阅等级（free/pro/premium）
  features: Record<string, unknown> // 功能权限
  iat?: number // 签发时间
  exp?: number // 过期时间
}
