import { z } from 'zod'

/**
 * 匿名 signup 后、session_exchange 完成前的待交换会话。
 * 持久化以便 Worker 不可达时重试复用同一匿名用户，避免反复 mint。
 * 仅用于 exchange 及其 refresh；禁止写入 legacy `yiveno:auth_session`、禁止调 AI。
 */
export const PendingAnonymousSessionSchema = z.object({
  /** 瞬态 Supabase access（仅 exchange / 自身 refresh） */
  accessToken: z.string().min(1),
  /** GoTrue refresh；过期时先 refresh 再 exchange */
  refreshToken: z.string().min(1).optional(),
  /** 匿名用户 UUID */
  userId: z.uuid(),
  /** access 过期时间（ISO） */
  expiresAt: z.string().datetime(),
  /** 本机首次写入时间（ISO） */
  createdAt: z.string().datetime(),
  /** 最近一次 exchange 尝试时间（ISO）；用于退避 */
  lastExchangeAttemptAt: z.string().datetime().optional()
})

export type PendingAnonymousSession = z.infer<typeof PendingAnonymousSessionSchema>

/** chrome.storage.local 键名（独立于 device / legacy auth）。 */
export const PENDING_ANON_SESSION_STORAGE_KEY = 'yiveno:pending_anon_session' as const

/** exchange 失败后的最小重试间隔（15 分钟）。 */
export const PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS = 15 * 60 * 1000

/**
 * exchange 连续 401（invalid_token）后的熔断窗口（60 分钟）。
 * 与待交换会话分键；窗口内 ensure 不 signup / 不 exchange，避免系统性 401 刷孤儿用户。
 */
export const ANON_EXCHANGE_401_BACKOFF_MS = 60 * 60 * 1000

/** chrome.storage.local 键：401 熔断状态（清除 pending 时不动）。 */
export const ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY = 'yiveno:anon_exchange_401_backoff' as const

/** 401 熔断持久化形状。 */
export const AnonExchange401BackoffSchema = z.object({
  /** 最近一次 exchange 401 时间（ISO） */
  last401At: z.string().datetime(),
  /** 累计 401 次数（本机；成功清零） */
  count: z.number().int().positive()
})

export type AnonExchange401Backoff = z.infer<typeof AnonExchange401BackoffSchema>

/** access 过期判定的时钟偏差余量。 */
export const PENDING_ANON_ACCESS_CLOCK_SKEW_MS = 60_000

/** 日志用：只暴露 token 末 4 字符（与 device token 同口径）。 */
export function maskPendingAccessTokenForLog(accessToken: string): string {
  if (accessToken.length <= 4) {
    return '****'
  }
  return `…${accessToken.slice(-4)}`
}
