/**
 * 安全响应头中间件
 *
 * 使用 Hono 的 Secure Headers 中间件添加安全响应头
 */

import { secureHeaders } from 'hono/secure-headers'

/**
 * 安全响应头中间件
 *
 * 自动添加以下安全响应头：
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Content-Security-Policy: default-src 'self'
 *
 * @returns Secure Headers 中间件
 *
 * @example
 * ```typescript
 * // 在应用中使用
 * app.use('*', secureHeadersMiddleware())
 * ```
 */
export function secureHeadersMiddleware() {
  return secureHeaders({
    // X-Content-Type-Options: 防止 MIME 类型嗅探
    xContentTypeOptions: 'nosniff',

    // X-Frame-Options: 防止点击劫持
    xFrameOptions: 'DENY',

    // X-XSS-Protection: 启用浏览器 XSS 过滤器
    xXssProtection: '1; mode=block',

    // Referrer-Policy: 控制 Referer 头信息
    referrerPolicy: 'strict-origin-when-cross-origin',

    // Content-Security-Policy: 内容安全策略
    // 注意：这是一个严格的策略，可能需要根据实际需求调整
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  })
}
