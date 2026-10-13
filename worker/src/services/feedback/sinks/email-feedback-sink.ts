/**
 * 反馈邮件 sink：Worker send_email → 运营已验证目标（Gmail）。
 *
 * - From = `feedback@`（轨道 1 产品意见；与欢迎信 `hello@` 分开）
 * - To = Email Routing **已验证 destination**（默认运营 Gmail；`FEEDBACK_TO_EMAIL` 可覆盖）
 *   勿把 `feedback@` 当 TO（会 destination not verified）
 * - 正文面向运营（表格分区），不写用户向引导句
 * 发送失败不抛，不挡用户 Thanks。
 */

import type { Env } from '../../../types/env'
import { error as logErrorMessage, info, warn, toLogError } from '../../../utils/logger'
import type { FeedbackEvent, UninstallFeedbackReason } from '../feedback-event'

const FROM_EMAIL = 'feedback@yiveno.com'
const FROM_NAME = 'Yiveno'
/** 与 Dashboard → Email Routing → Destination addresses 一致 */
const DEFAULT_TO = 'hi.yiveno@gmail.com'

/** 运营邮件展示用短标签（与官网闭集文案对齐，非用户可见产品 UI） */
const REASON_LABELS: Record<UninstallFeedbackReason, string> = {
  didnt_find: "Didn't find what I saved",
  too_hard: 'Too hard / confusing',
  missing_feature: 'Missing a feature',
  privacy: 'Privacy / permissions',
  bugs_or_slow: 'Bugs or slow',
  just_trying: 'Just trying it out',
  other: 'Other'
}

export type EmailFeedbackSinkResult =
  { ok: true; messageId: string } | { ok: false; reason: 'no_binding' | 'send_failed' }

function feedbackToAddress(env: Env): string {
  const raw = env.FEEDBACK_TO_EMAIL?.trim()
  return raw && raw.includes('@') ? raw : DEFAULT_TO
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function orNone(value: string | undefined): string {
  const v = value?.trim()
  return v && v.length > 0 ? v : '—'
}

/** 从 UA 抽简短浏览器摘要，方便扫一眼 */
function summarizeUserAgent(ua: string | undefined): string {
  const raw = ua?.trim()
  if (!raw) return '—'
  const chrome = /Chrome\/([\d.]+)/.exec(raw)
  const edg = /Edg\/([\d.]+)/.exec(raw)
  const firefox = /Firefox\/([\d.]+)/.exec(raw)
  const safari = /Version\/([\d.]+).*Safari/.exec(raw)
  const mac = /Mac OS X ([\d_]+)/.exec(raw)
  const win = /Windows NT ([\d.]+)/.exec(raw)
  const parts: string[] = []
  if (edg) parts.push(`Edge ${edg[1]}`)
  else if (chrome) parts.push(`Chrome ${chrome[1]}`)
  else if (firefox) parts.push(`Firefox ${firefox[1]}`)
  else if (safari) parts.push(`Safari ${safari[1]}`)
  if (mac) parts.push(`macOS ${mac[1]!.replaceAll('_', '.')}`)
  else if (win) parts.push(`Windows NT ${win[1]}`)
  return parts.length > 0 ? parts.join(' · ') : raw.slice(0, 80)
}

function formatCreatedAt(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  try {
    const utc = new Date(ms)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, ' UTC')
    const shanghai = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date(ms))
    return `${shanghai} CST · ${utc}`
  } catch {
    return iso
  }
}

function reasonRows(event: FeedbackEvent): { slug: string; label: string }[] {
  const slugs =
    event.reasons && event.reasons.length > 0 ? event.reasons : event.reason ? [event.reason] : []
  return slugs.map(slug => ({
    slug,
    label: REASON_LABELS[slug] ?? slug
  }))
}

type KvRow = { label: string; valueHtml: string; mono?: boolean }

function kvTable(rows: KvRow[]): string {
  const body = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f7f8f6'
      const valueStyle = row.mono
        ? 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;word-break:break-all;color:#1a1f1c;'
        : 'font-size:14px;color:#1a1f1c;word-break:break-word;'
      return [
        `<tr>`,
        `<td style="padding:10px 14px;width:140px;vertical-align:top;background:${bg};border-bottom:1px solid #e6e9e4;font-size:12px;font-weight:600;color:#5c665f;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(row.label)}</td>`,
        `<td style="padding:10px 14px;vertical-align:top;background:${bg};border-bottom:1px solid #e6e9e4;${valueStyle}">${row.valueHtml}</td>`,
        `</tr>`
      ].join('')
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e6e9e4;border-radius:8px;overflow:hidden;">${body}</table>`
}

function section(title: string, inner: string): string {
  return [
    `<tr><td style="padding:0 0 8px 0;font-size:13px;font-weight:700;color:#2f3a33;letter-spacing:0.02em;">${escapeHtml(title)}</td></tr>`,
    `<tr><td style="padding:0 0 20px 0;">${inner}</td></tr>`
  ].join('')
}

function reasonChipsHtml(rows: { slug: string; label: string }[]): string {
  if (rows.length === 0) {
    return `<p style="margin:0;color:#8a938c;font-size:14px;">—</p>`
  }
  const chips = rows
    .map(
      r =>
        `<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:999px;background:#eef5ef;border:1px solid #c9dcc9;font-size:13px;color:#1f3d2a;"><strong style="font-weight:600;">${escapeHtml(r.label)}</strong> <span style="color:#6b7a6e;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;">${escapeHtml(r.slug)}</span></span>`
    )
    .join('')
  return `<div>${chips}</div>`
}

function noteBoxHtml(note: string): string {
  const empty = !note.trim() || note.trim() === '(none)'
  if (empty) {
    return `<div style="padding:14px 16px;border:1px dashed #cfd6ce;border-radius:8px;background:#fafbf9;color:#8a938c;font-size:14px;">No note</div>`
  }
  return `<div style="padding:14px 16px;border:1px solid #d7e0d4;border-radius:8px;background:#f4f8f3;font-size:15px;line-height:1.5;color:#1a1f1c;white-space:pre-wrap;">${escapeHtml(note)}</div>`
}

function buildCopy(event: FeedbackEvent): { subject: string; text: string; html: string } {
  const reasons = reasonRows(event)
  const reasonsLabel =
    reasons.length > 0 ? reasons.map(r => `${r.label} (${r.slug})`).join('; ') : '—'
  const subjectTag = event.reason ?? event.reasons?.[0] ?? 'note'
  const note = event.note?.trim() || ''
  const ctx = event.context
  const subject = `[Yiveno feedback] ${event.source} · ${subjectTag}`
  const displayName = orNone(ctx?.displayName)
  const email = ctx?.email?.trim() || ''
  const emailHtml = email
    ? `<a href="mailto:${escapeHtml(email)}" style="color:#1f6b4a;text-decoration:underline;">${escapeHtml(email)}</a>`
    : '—'
  const ua = ctx?.userAgent?.trim() || ''
  const browserSummary = summarizeUserAgent(ua)
  const created = formatCreatedAt(event.createdAt)

  const text = [
    'Yiveno · Internal feedback (ops)',
    '================================',
    '',
    'SUMMARY',
    `  Source:     ${event.source}`,
    `  Created:    ${created}`,
    `  Id:         ${event.id}`,
    '',
    'REASONS',
    ...(reasons.length > 0 ? reasons.map(r => `  - ${r.label}  [${r.slug}]`) : ['  —']),
    '',
    'NOTE',
    note ? note.replace(/^/gm, '  ') : '  (none)',
    '',
    'USER',
    `  Name:       ${displayName}`,
    `  Email:      ${email || '—'}`,
    '',
    'ENVIRONMENT',
    `  Browser:    ${browserSummary}`,
    `  User-Agent: ${ua || '—'}`,
    `  IP:         ${orNone(ctx?.ip)}`,
    `  Language:   ${orNone(ctx?.language)}`,
    `  Timezone:   ${orNone(ctx?.timezone)}`,
    `  Screen:     ${orNone(ctx?.screen)}`,
    ''
  ].join('\n')

  const summaryTable = kvTable([
    { label: 'Source', valueHtml: escapeHtml(event.source) },
    { label: 'Created', valueHtml: escapeHtml(created) },
    { label: 'Id', valueHtml: escapeHtml(event.id), mono: true }
  ])

  const userTable = kvTable([
    { label: 'Name', valueHtml: escapeHtml(displayName) },
    { label: 'Email', valueHtml: emailHtml }
  ])

  const envTable = kvTable([
    { label: 'Browser', valueHtml: escapeHtml(browserSummary) },
    { label: 'User-Agent', valueHtml: escapeHtml(orNone(ua)), mono: true },
    { label: 'IP', valueHtml: escapeHtml(orNone(ctx?.ip)), mono: true },
    { label: 'Language', valueHtml: escapeHtml(orNone(ctx?.language)) },
    { label: 'Timezone', valueHtml: escapeHtml(orNone(ctx?.timezone)) },
    { label: 'Screen', valueHtml: escapeHtml(orNone(ctx?.screen)) }
  ])

  const html = [
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2ef;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2ef;padding:24px 12px;">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dde3da;border-radius:12px;overflow:hidden;">`,
    // header
    `<tr><td style="padding:18px 22px;background:#1f3d2a;color:#ffffff;">`,
    `<div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;margin-bottom:6px;">Internal ops · not a user thread</div>`,
    `<div style="font-size:20px;font-weight:700;line-height:1.25;">Uninstall feedback</div>`,
    `<div style="margin-top:6px;font-size:13px;opacity:0.85;">${escapeHtml(reasonsLabel)}</div>`,
    `</td></tr>`,
    // body
    `<tr><td style="padding:22px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">`,
    section('Summary', summaryTable),
    section('Reasons', reasonChipsHtml(reasons)),
    section('Note', noteBoxHtml(note || '(none)')),
    section('User', userTable),
    section('Environment', envTable),
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</td></tr></table>`,
    `</body></html>`
  ].join('')

  return { subject, text, html }
}

/**
 * 尽力外发（From=feedback@ → 已验证 destination）；失败只打日志。
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
