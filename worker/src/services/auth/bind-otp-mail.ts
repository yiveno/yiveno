/**
 * 绑定 OTP 邮件：中英模板 + DirectMail 发送。
 */

import type { Env } from '../../types/env'
import { sendDirectMail, type DirectMailSendResult } from '../email/aliyun-directmail'

export type BindOtpLocale = 'zh' | 'en'

export type BindOtpMailContent = {
  subject: string
  text: string
  html: string
}

/** 构造验证码邮件（含 10 分钟有效与非本人忽略文案） */
export function buildBindOtpMail(code: string, locale: BindOtpLocale): BindOtpMailContent {
  if (locale === 'en') {
    const subject = 'Your Yiveno verification code'
    const text = [
      `Your verification code is: ${code}`,
      '',
      'This code expires in 10 minutes.',
      "If you didn't request this, ignore it."
    ].join('\n')
    const html = [
      '<p style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">',
      'Your verification code is:',
      '</p>',
      `<p style="font-family:ui-monospace,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:0.12em;color:#111">${code}</p>`,
      '<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#444">',
      'This code expires in 10 minutes.',
      '<br/>',
      "If you didn't request this, ignore it.",
      '</p>'
    ].join('')
    return { subject, text, html }
  }

  const subject = '你的 Yiveno 验证码'
  const text = [`你的验证码是：${code}`, '', '验证码 10 分钟内有效。', '非本人操作请忽略。'].join(
    '\n'
  )
  const html = [
    '<p style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">',
    '你的验证码是：',
    '</p>',
    `<p style="font-family:ui-monospace,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:0.12em;color:#111">${code}</p>`,
    '<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#444">',
    '验证码 10 分钟内有效。',
    '<br/>',
    '非本人操作请忽略。',
    '</p>'
  ].join('')
  return { subject, text, html }
}

/**
 * 发送绑定验证码邮件。返回 sendDirectMail 原样结果。
 */
export async function sendBindOtpMail(
  env: Env,
  email: string,
  code: string,
  locale: BindOtpLocale
): Promise<DirectMailSendResult> {
  const content = buildBindOtpMail(code, locale)
  return sendDirectMail(env, {
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html
  })
}
