/**
 * 扩展卸载落地页可选反馈 HTTP 入口。
 * 校验 / 限流后交给 recordFeedback（KV 底账 + 尽力邮件）。
 */

import { z } from 'zod'
import type { Env } from '../types/env'
import { UNINSTALL_FEEDBACK_REASONS } from '../services/feedback/feedback-event'
import { recordFeedback } from '../services/feedback/record-feedback'
import { info, warn } from '../utils/logger'

const UninstallFeedbackBodySchema = z.object({
  reason: z.enum(UNINSTALL_FEEDBACK_REASONS),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform(v => (v && v.length > 0 ? v : undefined)),
  /** 蜜罐：机器人会填；真人应为空 */
  website: z.string().max(200).optional()
})

const MAX_PER_IP_PER_DAY = 6
const RATE_LIMIT_PREFIX = 'uninstall-fb-rl:'

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const firstForwarded = forwarded?.split(',')[0]?.trim()
  return request.headers.get('cf-connecting-ip') || firstForwarded || 'unknown'
}

/** 本机 wrangler / 单测：不吃日限流（remote KV 上的计数会把维护者探针卡死一整天） */
function isLocalDevHost(request: Request): boolean {
  try {
    const host = new URL(request.url).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
  } catch {
    return false
  }
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
  if (used >= MAX_PER_IP_PER_DAY) return true
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
 * POST /api/website/uninstall-feedback
 */
export async function handleWebsiteUninstallFeedback(
  request: Request,
  env: Env
): Promise<Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const parsed = UninstallFeedbackBodySchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: 'invalid_body' }, 400)
  }

  if (parsed.data.website && parsed.data.website.trim() !== '') {
    info('[UninstallFeedback] 蜜罐命中，静默成功', {})
    return json({ ok: true })
  }

  const ip = clientIp(request)
  if (!isLocalDevHost(request) && (await isRateLimited(env, ip))) {
    warn('[UninstallFeedback] IP 日限流', { ip })
    return json({ error: 'rate_limited' }, 429)
  }

  const result = await recordFeedback(env, {
    source: 'uninstall',
    reason: parsed.data.reason,
    ...(parsed.data.note ? { note: parsed.data.note } : {})
  })

  if (!result.ok) {
    return json({ error: 'unavailable' }, 503)
  }

  info('[UninstallFeedback] 已记录', {
    id: result.id,
    email: result.sinks.email
  })
  return json({ ok: true, id: result.id, email: result.sinks.email })
}

/** 供测试与官网选项同步 */
export { UNINSTALL_FEEDBACK_REASONS }
