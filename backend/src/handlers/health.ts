/**
 * 健康检查处理器
 */

import { okJson } from '../utils/response'

/**
 * 处理健康检查请求
 *
 * @param origin - 请求来源
 * @returns 健康状态响应
 */
export function handleHealth(origin: string | null): Response {
  return okJson(
    {
      status: 'ok',
      runtime: 'cloudflare-worker',
      timestamp: new Date().toISOString()
    },
    origin
  )
}
