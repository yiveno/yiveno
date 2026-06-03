/**
 * Bearer Token 认证中间件
 *
 * 使用 Hono 的 Bearer Auth 中间件验证 Bearer token
 */

import { bearerAuth } from 'hono/bearer-auth'

/**
 * Bearer Auth 中间件工厂函数
 *
 * 用于验证 API Key 或简单的 Bearer token
 *
 * @param token - Bearer token 字符串
 * @returns Bearer Auth 中间件
 *
 */
export function bearerAuthMiddleware(token: string) {
  return bearerAuth({
    token,
    // 自定义错误响应
    invalidTokenMessage: 'Invalid or missing Bearer token',
    noAuthenticationHeaderMessage: 'Missing Authorization header'
  })
}
