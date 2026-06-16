/**
 * CORS 中间件
 *
 * 负责处理跨域请求的安全策略
 */

/**
 * 允许的 CORS 来源列表
 *
 * 安全策略：只允许特定域名访问 API
 */
export const ALLOWED_ORIGINS = [
  'https://ottersage.com',
  'https://www.ottersage.com',
  'https://app.ottersage.com',
  'https://api.ottersage.com',
  // 开发环境
  'http://localhost:3001',
  'https://localhost:3001',
  'http://localhost:5173',
  'https://localhost:5173'
  // Chrome Extension 的 origin 会在运行时动态添加（chrome-extension://...）
]

/**
 * 获取 CORS 响应头
 *
 * @param origin - 请求来源
 * @returns CORS 响应头对象
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Chrome Extension 的 origin 格式：chrome-extension://extension-id
  const isChromeExtension = origin?.startsWith('chrome-extension://')

  // 检查是否为允许的来源
  const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || isChromeExtension)

  if (isAllowed) {
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
      'access-control-allow-credentials': 'true',
      'access-control-max-age': '86400' // 24 小时
    }
  }

  // 不允许的来源：返回空的 CORS 头（浏览器会阻止请求）
  return {
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization'
  }
}
