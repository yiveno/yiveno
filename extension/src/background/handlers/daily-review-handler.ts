/**
 * Dreaming 每日回顾 Background handler（只读）。
 */

import { buildDailyReviewForCurrentOwner } from '@/application/dreaming/build-daily-review-service'
import type { GetDailyReviewResponse } from '@/core/messaging/daily-review-messages'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function toErrorPayload(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

/** GET_DAILY_REVIEW — 本地日历昨日回顾（无请求参数）。 */
export async function handleGetDailyReview(): Promise<GetDailyReviewResponse> {
  const startedAt = flowStart('Dreaming', 'GET_DAILY_REVIEW')
  try {
    const response = await buildDailyReviewForCurrentOwner()
    if (response.ok) {
      flowOk('Dreaming', 'GET_DAILY_REVIEW', startedAt, {
        aiFeaturesEnabled: response.aiFeaturesEnabled,
        totalNotes: response.totalNotes,
        yesterdayCount: response.yesterdayCount,
        groupCount: response.groups.length,
        hasFeatured: response.featured != null,
        hasStale: response.stale != null
      })
    } else {
      flowOk('Dreaming', 'GET_DAILY_REVIEW', startedAt, {
        ok: false,
        errorCode: response.errorCode
      })
    }
    return response
  } catch (error) {
    flowFail('Dreaming', 'GET_DAILY_REVIEW', startedAt, error)
    const debug = toErrorPayload(error)
    return {
      ok: false,
      errorCode: 'DAILY_REVIEW_LOAD_FAILED',
      ...(debug ? { error: debug } : {})
    }
  }
}
