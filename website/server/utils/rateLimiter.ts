/**
 * 简单的内存 Rate Limiter
 * 限制每个 IP 的请求频率
 */

import type { H3Event } from 'h3'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Rate Limiter 配置
 */
const RATE_LIMIT_CONFIG = {
  // 时间窗口（毫秒）
  windowMs: 5 * 60 * 1000, // 5 分钟
  // 最大请求次数
  maxRequests: 3
}

/**
 * 检查是否超过速率限制
 * @param identifier 标识符（通常是 IP 地址）
 * @returns 是否允许请求
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean
  remaining: number
  resetTime: number
} {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // 如果没有记录或已过期，创建新记录
  if (!entry || now > entry.resetTime) {
    const resetTime = now + RATE_LIMIT_CONFIG.windowMs
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime
    })

    // 清理过期记录（每 100 次请求清理一次，避免内存泄漏）
    if (rateLimitStore.size > 1000) {
      for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
          rateLimitStore.delete(key)
        }
      }
    }

    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests - 1,
      resetTime
    }
  }

  // 检查是否超过限制
  if (entry.count >= RATE_LIMIT_CONFIG.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }

  // 增加计数
  entry.count++
  rateLimitStore.set(identifier, entry)

  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * 获取客户端 IP 地址
 */
export function getClientIP(event: H3Event): string {
  // 优先从 X-Forwarded-For 获取（代理环境）
  const forwarded = event.node.req.headers['x-forwarded-for']
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
    return ip?.trim() || '0.0.0.0'
  }

  // 从 X-Real-IP 获取
  const realIP = event.node.req.headers['x-real-ip']
  if (realIP) {
    const ip = Array.isArray(realIP) ? realIP[0] : realIP
    return ip || '0.0.0.0'
  }

  // 从连接获取
  return event.node.req.socket?.remoteAddress || 'unknown'
}
