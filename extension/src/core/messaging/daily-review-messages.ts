/**
 * Dreaming 每日回顾消息（楔子 #1 · 只读）。
 */

import type {
  DailyReviewFeatured,
  DailyReviewGroup,
  DailyReviewStale
} from '@/core/dreaming/build-daily-review'
import type { BackgroundMessageScope } from '@/core/messaging/constants'
import { z } from 'zod'

/** 每日回顾稳定错误码。 */
export const DailyReviewErrorCodeSchema = z.enum([
  'DAILY_REVIEW_LOAD_FAILED' // 读取命题 / 链路状态 / 设置失败
])

export type DailyReviewErrorCode = z.infer<typeof DailyReviewErrorCodeSchema>

/** 读取本地日历「昨日」回顾（无请求参数；日期由 service 按本地时区算）。 */
export type GetDailyReviewMessage = {
  scope: BackgroundMessageScope
  type: 'GET_DAILY_REVIEW'
}

export type GetDailyReviewResponse =
  | {
      ok: true
      aiFeaturesEnabled: boolean
      totalNotes: number
      yesterdayCount: number
      groups: DailyReviewGroup[]
      featured: DailyReviewFeatured | null
      stale: DailyReviewStale | null
      skippedDirtyNotes: number
      groupsTruncated: boolean
      /** 触顶安全 bound 时为 true（listByOwnerUpdated limit）。 */
      notesHitScanLimit: boolean
    }
  | {
      ok: false
      errorCode: DailyReviewErrorCode
      error?: string
    }

export type DailyReviewBackgroundMessage = GetDailyReviewMessage

export type DailyReviewBackgroundResponse = GetDailyReviewResponse
