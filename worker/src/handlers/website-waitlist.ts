/**
 * 官网预约名单：校验邮箱、蜜罐、按 IP 限流后写入 Supabase。
 * 不把完整邮箱打进日志。
 */

import { z } from 'zod'
import type { Env } from '../types/env'
import { createSupabaseClient } from '../data-access/supabase'
import { info, warn, error as logErrorMessage, toLogError } from '../utils/logger'

const WaitlistBodySchema = z.object({
  email: z.string().trim().email().max(254),
  /** 蜜罐：机器人会填；真人应为空 */
  company: z.string().max(200).optional()
})

const MAX_SIGNUPS_PER_IP_PER_DAY = 8
const RATE_LIMIT_PREFIX = 'waitlist-rl:'

function previewEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return 'invalid'
  const domain = email.slice(at + 1)
  return `${email.slice(0, 2)}…@${domain}`
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown'
  )
}

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

async function isRateLimited(env: Env, ip: string): Promise<boolean> {
  if (!env.AI_USAGE_KV || ip === 'unknown') return false
  const key = `${RATE_LIMIT_PREFIX}${utcDayKey()}:${ip}`
  const raw = await env.AI_USAGE_KV.get(key)
  const used = raw ? Number.parseInt(raw, 10) : 0
  if (!Number.isFinite(used)) return false
  if (used >= MAX_SIGNUPS_PER_IP_PER_DAY) return true
  const next = used + 1
  const now = new Date()
  const endOfUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  const ttl = Math.max(60, Math.floor((endOfUtcDay - now.getTime()) / 1000))
  await env.AI_USAGE_KV.put(key, String(next), { expirationTtl: ttl })
  return false
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}

/**
 * POST /api/website/waitlist
 */
export async function handleWebsiteWaitlist(request: Request, env: Env): Promise<Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const parsed = WaitlistBodySchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: 'invalid_email' }, 400)
  }

  if (parsed.data.company && parsed.data.company.trim() !== '') {
    info('[Waitlist] 蜜罐命中，静默成功', {})
    return json({ ok: true })
  }

  const email = parsed.data.email.toLowerCase()
  const ip = clientIp(request)

  if (await isRateLimited(env, ip)) {
    warn('[Waitlist] IP 日限流', { ip })
    return json({ error: 'rate_limited' }, 429)
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) {
    logErrorMessage('[Waitlist] Supabase 未配置', {})
    return json({ error: 'unavailable' }, 503)
  }

  info('[Waitlist] 写入开始', { emailPreview: previewEmail(email) })
  const { error } = await supabase.from('website_waitlist').insert({ email })

  if (error) {
    if (error.code === '23505') {
      info('[Waitlist] 已在名单中', { emailPreview: previewEmail(email) })
      return json({ ok: true })
    }
    logErrorMessage('[Waitlist] 写入失败', { detail: toLogError(error), code: error.code })
    return json({ error: 'unavailable' }, 503)
  }

  info('[Waitlist] 写入成功', { emailPreview: previewEmail(email) })
  return json({ ok: true })
}
