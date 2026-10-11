/**
 * 结构化反馈统一入口：契约钉死，sink 可插拔（kv / email；日后 db）。
 * KV 必成即对用户成功；邮件默认可延期（waitUntil），不挡 HTTP。
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

export type RecordFeedbackOptions = {
  /**
   * 有则把邮件任务挂上去（waitUntil / fire-and-forget），HTTP 不等待。
   * 无则同步 await（单测断言 email sink 时用）。
   */
  scheduleEmail?: (task: Promise<unknown>) => void
}

export type RecordFeedbackResult =
  | {
      ok: true
      id: string
      sinks: { kv: true; email: boolean | 'deferred' }
    }
  | { ok: false; error: 'kv_unavailable' }

/**
 * 写入底账（KV 必成）。邮件尽力；可延期，失败不导致整体失败。
 */
export async function recordFeedback(
  env: Env,
  input: RecordFeedbackInput,
  options?: RecordFeedbackOptions
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

  const emailTask = sendFeedbackEmail(env, event).then(email => {
    info('[Feedback] 邮件 sink 收尾', { id: event.id, email: email.ok })
    return email
  })

  if (options?.scheduleEmail) {
    options.scheduleEmail(emailTask)
    info('[Feedback] record 完成（邮件已延期）', { id: event.id, kv: true })
    return {
      ok: true,
      id: event.id,
      sinks: { kv: true, email: 'deferred' }
    }
  }

  const email = await emailTask
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
