/**
 * 管理员路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleAdminEnvCheck } from '../handlers/admin'
import type { JWTPayload } from '../middleware/jwt'

export const adminRouter = new Hono<{ Bindings: Env }>()

/**
 * GET /api/admin/env/check
 *
 * 检查环境变量配置
 *
 * 需要 JWT 认证
 */
adminRouter.get('/env/check', async c => {
  const request = c.req.raw
  const env = c.env
  const origin = request.headers.get('origin')

  // JWT payload 由 jwtAuth() 中间件自动注入到 c.get('jwtPayload')
  const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined

  // 可选：检查用户权限
  if (jwtPayload && jwtPayload.tier !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403)
  }

  return handleAdminEnvCheck(request, env, origin)
})
