/**
 * 首次授 Pro 后的产品欢迎信（与 Dodo 收据分开）。
 * 规范：产品文档 §A.3。发信失败不得影响 webhook 投影。
 */

import { createSupabaseClient } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, warn } from '../../utils/logger'
import type { DodoWebhookEvent } from './dodo-webhook'
import type { ProjectWebhookResult } from './projection'

const FROM_EMAIL = 'hello@yiveno.com'
const FROM_NAME = 'Yiveno'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function emailBinding(env: Env): SendEmail | null {
  return env.EMAIL ?? null
}

function websiteOrigin(env: Env): string {
  return (env.WEBSITE_URL || '').replace(/\/$/, '') || 'https://yiveno.com'
}

/**
 * payload 里的付款人邮箱（Dodo customer.email 或顶层 email）。
 */
export function extractCustomerEmail(data: Record<string, unknown>): string | null {
  const nested = readString(asRecord(data.customer), 'email')
  const top = readString(data, 'email')
  const email = nested || top
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

/**
 * 仅首次授 Pro：`subscription.active` 且投影 applied、无 skip reason。
 */
export function shouldSendProWelcomeEmail(
  eventType: string,
  result: ProjectWebhookResult
): boolean {
  if (eventType !== 'subscription.active') return false
  if (result.outcome !== 'applied') return false
  if (result.reason) return false
  return true
}

async function resolveRecipientEmail(env: Env, event: DodoWebhookEvent): Promise<string | null> {
  const fromPayload = extractCustomerEmail(event.data)
  if (fromPayload) return fromPayload

  const userId = readString(asRecord(event.data.metadata), 'yiveno_user_id')
  if (!userId) return null

  const supabase = createSupabaseClient(env)
  if (!supabase) return null

  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    warn('[Billing] 查 Auth 邮箱失败，无法发欢迎信', { userId, detail: error.message })
    return null
  }
  const email = data.user?.email?.trim() || null
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

function welcomeCopy(origin: string): { subject: string; text: string; html: string } {
  const accountUrl = `${origin}/account`
  const subject = 'Your Yiveno Pro is ready'
  const text = [
    "You're on Yiveno Pro.",
    '',
    'Cloud sync and the higher hosted-clue quota are now available. Open the Chrome extension, go to Settings, and turn on sync when you are ready.',
    '',
    `Manage your subscription at ${accountUrl}`,
    '',
    'Payment receipts come from Dodo Payments separately.'
  ].join('\n')
  const html = [
    '<p>You&rsquo;re on Yiveno Pro.</p>',
    '<p>Cloud sync and the higher hosted-clue quota are now available. Open the Chrome extension, go to Settings, and turn on sync when you are ready.</p>',
    `<p>Manage your subscription at <a href="${accountUrl}">${accountUrl}</a></p>`,
    '<p>Payment receipts come from Dodo Payments separately.</p>'
  ].join('')
  return { subject, text, html }
}

export type SendProWelcomeResult =
  | { sent: true; messageId: string } // 已交给 Email Sending
  | { sent: false; reason: 'no_binding' | 'no_recipient' | 'send_failed' } // 跳过或失败（不抛）

/**
 * 发送产品欢迎信。调用方须在 webhook 已 200 路径上 waitUntil；本函数自行吞掉发送错误。
 */
export async function sendProWelcomeEmail(
  env: Env,
  event: DodoWebhookEvent
): Promise<SendProWelcomeResult> {
  const eventId = event.eventId
  info('[Billing] 准备发送 Pro 欢迎信', { eventId, eventType: event.eventType })

  const binding = emailBinding(env)
  if (!binding) {
    warn('[Billing] EMAIL 绑定缺失，跳过欢迎信', { eventId })
    return { sent: false, reason: 'no_binding' }
  }

  const to = await resolveRecipientEmail(env, event)
  if (!to) {
    warn('[Billing] 无收件人，跳过欢迎信', { eventId })
    return { sent: false, reason: 'no_recipient' }
  }

  const copy = welcomeCopy(websiteOrigin(env))
  try {
    const response = await binding.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: copy.subject,
      text: copy.text,
      html: copy.html
    })
    info('[Billing] Pro 欢迎信已提交', { eventId, messageId: response.messageId })
    return { sent: true, messageId: response.messageId }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    const code =
      err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
        ? err.code
        : null
    logErrorMessage('[Billing] Pro 欢迎信发送失败', { eventId, detail, code })
    return { sent: false, reason: 'send_failed' }
  }
}
