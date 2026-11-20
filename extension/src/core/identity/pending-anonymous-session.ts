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

/** access 过期判定的时钟偏差余量。 */
export const PENDING_ANON_ACCESS_CLOCK_SKEW_MS = 60_000

/** 日志用：只暴露 token 末 4 字符（与 device token 同口径）。 */
export function maskPendingAccessTokenForLog(accessToken: string): string {
  if (accessToken.length <= 4) {
    return '****'
  }
  return `…${accessToken.slice(-4)}`
}
