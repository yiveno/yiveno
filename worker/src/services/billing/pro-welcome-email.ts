/**
 * 首次授 Pro 后的产品欢迎信（与 Dodo 收据分开）。
 * 规范：产品文档 §A.3。通道 = 阿里云 DirectMail（非 CF Email Sending）。
 * 发信失败不得影响 webhook 投影。
 */

import { createSupabaseClient } from '../../data-access/supabase'
import { isDirectMailConfigured, sendDirectMail } from '../email/aliyun-directmail'
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

/** Brand Core 邮件内联色（设计标准 · 不依赖外部 CSS） */
const EMAIL_INK = '#222c24'
const EMAIL_MUTED = '#82998c'
const EMAIL_SAGE = '#4b6054'
const EMAIL_SAGE_ON = '#d8ede2'
const EMAIL_PAPER = '#f0f3ee'
const EMAIL_BORDER = '#d5ddd6'

/**
 * Pro 欢迎信定稿文案（美式英语 · 轻品牌单栏）。
 * 产品致谢归本信；支付确认归 Dodo；主 CTA → /account。
 */
export function welcomeCopy(origin: string): { subject: string; text: string; html: string } {
  const accountUrl = `${origin}/account`
  const logoUrl = `${origin}/images/logo-mark.svg`
  const subject = "You're on Yiveno Pro"
  const preview = 'Cloud sync and more room for clue understanding are ready.'
  const text = [
    'Thanks for going Pro.',
    '',
    "You're all set. Cloud sync is available, and you have more room for hosted clue understanding when you need it.",
    '',
    "Next: open the Yiveno Chrome extension → Settings → turn on sync when you're ready.",
    '',
    'Manage your subscription anytime:',
    accountUrl,
    '',
    'Payment receipts come from Dodo Payments — this note is just from us.'
  ].join('\n')

  // 邮件客户端：表格式单栏 + 全内联样式；预览句对用户隐藏
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_PAPER};">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preview}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_PAPER};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${EMAIL_BORDER};border-radius:12px;">
        <tr>
          <td style="padding:28px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <img src="${logoUrl}" width="28" height="28" alt="" style="display:block;border:0;" />
                </td>
                <td style="vertical-align:middle;font-size:16px;font-weight:600;letter-spacing:-0.02em;color:${EMAIL_INK};">Yiveno</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;color:${EMAIL_INK};">
            Thanks for going Pro.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${EMAIL_INK};">
            You&rsquo;re all set. Cloud sync is available, and you have more room for hosted clue understanding when you need it.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${EMAIL_INK};">
            Next: open the Yiveno Chrome extension &rarr; Settings &rarr; turn on sync when you&rsquo;re ready.
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 8px;">
            <a href="${accountUrl}" style="display:inline-block;padding:12px 18px;background:${EMAIL_SAGE};color:${EMAIL_SAGE_ON};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1.2;text-decoration:none;border-radius:8px;">Manage subscription</a>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${EMAIL_MUTED};">
            Or open <a href="${accountUrl}" style="color:${EMAIL_SAGE};">${accountUrl}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px;border-top:1px solid ${EMAIL_BORDER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${EMAIL_MUTED};">
            Payment receipts come from Dodo Payments &mdash; this note is just from us.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  return { subject, text, html }
}

export type SendProWelcomeResult =
  | { sent: true; messageId: string } // DirectMail RequestId / EnvId
  | { sent: false; reason: 'not_configured' | 'no_recipient' | 'send_failed' } // 跳过或失败（不抛）

/**
 * 发送产品欢迎信。调用方须在 webhook 已 200 路径上 waitUntil；本函数自行吞掉发送错误。
 */
export async function sendProWelcomeEmail(
  env: Env,
  event: DodoWebhookEvent
): Promise<SendProWelcomeResult> {
  const eventId = event.eventId
  info('[Billing] 准备发送 Pro 欢迎信', { eventId, eventType: event.eventType })

  if (!isDirectMailConfigured(env)) {
    warn('[Billing] DirectMail 未配置，跳过欢迎信', { eventId })
    return { sent: false, reason: 'not_configured' }
  }

  const to = await resolveRecipientEmail(env, event)
  if (!to) {
    warn('[Billing] 无收件人，跳过欢迎信', { eventId })
    return { sent: false, reason: 'no_recipient' }
  }

  const copy = welcomeCopy(websiteOrigin(env))
  const result = await sendDirectMail(env, {
    to,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
    accountName: FROM_EMAIL,
    fromAlias: FROM_NAME
  })

  if (!result.ok) {
    logErrorMessage('[Billing] Pro 欢迎信发送失败', {
      eventId,
      reason: result.reason,
      detail: result.detail
    })
    return { sent: false, reason: 'send_failed' }
  }

  const messageId = result.envId || result.requestId
  info('[Billing] Pro 欢迎信已提交', { eventId, messageId, requestId: result.requestId })
  return { sent: true, messageId }
}
