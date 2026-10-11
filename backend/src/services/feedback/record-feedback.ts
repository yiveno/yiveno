/**
 * 结构化反馈统一入口：契约钉死，sink 可插拔（kv / email；日后 db）。
 */

import type { Env } from '../../types/env'
import { info } from '../../utils/logger'
import {
  createFeedbackEvent,
  type FeedbackSource,
  type UninstallFeedbackReason
} from './feedback-event'
import { sendFeedbackEmail } from './sinks/email-feedback-sink'
import { writeFeedbackToKv } from './sinks/kv-feedback-sink'

export type RecordFeedbackInput = {
  source: FeedbackSource
  reasons?: UninstallFeedbackReason[]
  /** @deprecated 单因；有则并入 reasons */
  reason?: UninstallFeedbackReason
  note?: string
}

export type RecordFeedbackResult =
  | {
      ok: true
      id: string
      sinks: { kv: boolean; email: boolean }
    }
  | { ok: false; error: 'kv_unavailable' }

/**
 * 写入底账（KV 必成）并尽力发邮件。邮件失败不导致整体失败。
 */
export async function recordFeedback(
  env: Env,
  input: RecordFeedbackInput
): Promise<RecordFeedbackResult> {
  const event = createFeedbackEvent(input)
  info('[Feedback] record 开始', {
    id: event.id,
    source: event.source,
    reasons: event.reasons ?? null,
    reason: event.reason ?? null,
    hasNote: Boolean(event.note)
  })

  const kv = await writeFeedbackToKv(env, event)
  if (!kv.ok) {
    return { ok: false, error: 'kv_unavailable' }
  }

  const email = await sendFeedbackEmail(env, event)
  info('[Feedback] record 完成', {
    id: event.id,
    kv: true,
    email: email.ok
  })

  return {
    ok: true,
    id: event.id,
    sinks: { kv: true, email: email.ok }
  }
}
