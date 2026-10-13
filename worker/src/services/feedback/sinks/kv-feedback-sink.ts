/**
 * 反馈底账 sink：AI_USAGE_KV，TTL≈180 天。
 */

import type { Env } from '../../../types/env'
import { error as logErrorMessage, info, toLogError } from '../../../utils/logger'
import type { FeedbackEvent } from '../feedback-event'

const FEEDBACK_KEY_PREFIX = 'feedback:'
const FEEDBACK_TTL_SECONDS = 180 * 24 * 60 * 60

export type KvFeedbackSinkResult =
  { ok: true; key: string } | { ok: false; reason: 'no_binding' | 'put_failed' }

export async function writeFeedbackToKv(
  env: Env,
  event: FeedbackEvent
): Promise<KvFeedbackSinkResult> {
  if (!env.AI_USAGE_KV) {
    logErrorMessage('[Feedback] AI_USAGE_KV 未绑定', { id: event.id })
    return { ok: false, reason: 'no_binding' }
  }

  const key = `${FEEDBACK_KEY_PREFIX}${event.id}`
  try {
    await env.AI_USAGE_KV.put(key, JSON.stringify(event), {
      expirationTtl: FEEDBACK_TTL_SECONDS
    })
    info('[Feedback] KV 写入成功', {
      id: event.id,
      source: event.source,
      reason: event.reason ?? null
    })
    return { ok: true, key }
  } catch (err) {
    logErrorMessage('[Feedback] KV 写入失败', {
      id: event.id,
      detail: toLogError(err)
    })
    return { ok: false, reason: 'put_failed' }
  }
}
