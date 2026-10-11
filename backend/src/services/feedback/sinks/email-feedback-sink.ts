/**
 * 反馈邮件 sink：Email Sending → feedback@（Routing 再进运营 Gmail）。
 * 未开通 Sending / 发送失败不抛，不挡用户 Thanks。
 */

import type { Env } from '../../../types/env'
import { error as logErrorMessage, info, warn, toLogError } from '../../../utils/logger'
import type { FeedbackEvent } from '../feedback-event'

const FROM_EMAIL = 'hello@yiveno.com'
const FROM_NAME = 'Yiveno'
const DEFAULT_TO = 'feedback@yiveno.com'

export type EmailFeedbackSinkResult =
  { ok: true; messageId: string } | { ok: false; reason: 'no_binding' | 'send_failed' }

function feedbackToAddress(env: Env): string {
  const raw = env.FEEDBACK_TO_EMAIL?.trim()
  return raw && raw.includes('@') ? raw : DEFAULT_TO
}

function buildCopy(event: FeedbackEvent): { subject: string; text: string; html: string } {
  const reason = event.reason ?? '(none)'
  const note = event.note?.trim() || '(none)'
  const subject = `[Yiveno feedback] ${event.source} · ${reason}`
  const text = [
    'Structured product feedback (no reply expected on this thread).',
    '',
    `id: ${event.id}`,
    `source: ${event.source}`,
    `reason: ${reason}`,
    `createdAt: ${event.createdAt}`,
    '',
    'note:',
    note,
    '',
    'For bugs that need a reply, users should use support@yiveno.com.'
  ].join('\n')
  const html = [
    '<p>Structured product feedback (no reply expected on this thread).</p>',
    '<ul>',
    `<li><strong>id:</strong> ${event.id}</li>`,
    `<li><strong>source:</strong> ${event.source}</li>`,
    `<li><strong>reason:</strong> ${reason}</li>`,
    `<li><strong>createdAt:</strong> ${event.createdAt}</li>`,
    '</ul>',
    '<p><strong>note</strong></p>',
    `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(note)}</pre>`,
    '<p>For bugs that need a reply, users should use support@yiveno.com.</p>'
  ].join('')
  return { subject, text, html }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * 尽力发到 feedback@；失败只打日志。
 */
export async function sendFeedbackEmail(
  env: Env,
  event: FeedbackEvent
): Promise<EmailFeedbackSinkResult> {
  const binding = env.EMAIL ?? null
  if (!binding) {
    warn('[Feedback] EMAIL 绑定缺失，跳过邮件 sink', { id: event.id })
    return { ok: false, reason: 'no_binding' }
  }

  const to = feedbackToAddress(env)
  const copy = buildCopy(event)
  try {
    const response = await binding.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: copy.subject,
      text: copy.text,
      html: copy.html
    })
    info('[Feedback] 邮件已提交', {
      id: event.id,
      to,
      messageId: response.messageId,
      source: event.source
    })
    return { ok: true, messageId: response.messageId }
  } catch (err) {
    logErrorMessage('[Feedback] 邮件发送失败', {
      id: event.id,
      to,
      detail: toLogError(err)
    })
    return { ok: false, reason: 'send_failed' }
  }
}
