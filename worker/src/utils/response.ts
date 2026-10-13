/**
 * 响应工具函数
 *
 * 统一的 JSON 响应生成器
 */

import { getCorsHeaders } from '../middleware/cors'

/**
 * 返回成功的 JSON 响应
 *
 * @param data - 响应数据
 * @param origin - 请求来源
 * @returns Response 对象
 */
export function okJson(data: unknown, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', ...getCorsHeaders(origin) }
  })
}

/**
 * 返回错误的 JSON 响应
 *
 * @param data - 错误数据
 * @param status - HTTP 状态码
 * @param origin - 请求来源
 * @returns Response 对象
 */
export function errorJson(data: unknown, status = 500, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...getCorsHeaders(origin) }
  })
}
