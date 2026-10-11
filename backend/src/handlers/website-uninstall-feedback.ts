/**
 * 扩展卸载落地页可选反馈 HTTP 入口。
 * 校验 / 限流后交给 recordFeedback（KV 底账 + 尽力邮件）。
 */

import { z } from 'zod'
import type { Env } from '../types/env'
import {
  normalizeUninstallReasons,
  UNINSTALL_FEEDBACK_REASONS
} from '../services/feedback/feedback-event'
import { recordFeedback } from '../services/feedback/record-feedback'
import { info, warn } from '../utils/logger'

const UninstallFeedbackBodySchema = z
  .object({
    /** 多选闭集；可与 note 二选一或并存 */
    reasons: z.array(z.enum(UNINSTALL_FEEDBACK_REASONS)).max(7).optional(),
    /** 旧单选字段；有则并入 reasons */
    reason: z.enum(UNINSTALL_FEEDBACK_REASONS).optional(),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform(v => (v && v.length > 0 ? v : undefined)),
    /** 蜜罐：机器人会填；真人应为空 */
    website: z.string().max(200).optional()
  })
  .superRefine((data, ctx) => {
    const reasons = normalizeUninstallReasons(data.reasons, data.reason)
    if (reasons.length === 0 && !data.note) {
      ctx.addIssue({
        code: 'custom',
        message: 'reasons_or_note_required'
      })
    }
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

export type UninstallFeedbackSchedule = {
  /** 邮件挂 waitUntil；单测无 executionCtx 时由调用方 fire-and-forget */
  scheduleEmail?: (task: Promise<unknown>) => void
}

/**
 * POST /api/website/uninstall-feedback
 * KV 写入成功即 200；邮件不挡响应。
 */
export async function handleWebsiteUninstallFeedback(
  request: Request,
  env: Env,
  schedule?: UninstallFeedbackSchedule
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

  const reasons = normalizeUninstallReasons(parsed.data.reasons, parsed.data.reason)
  const result = await recordFeedback(
    env,
    {
      source: 'uninstall',
      ...(reasons.length > 0 ? { reasons } : {}),
      ...(parsed.data.note ? { note: parsed.data.note } : {})
    },
    schedule?.scheduleEmail ? { scheduleEmail: schedule.scheduleEmail } : undefined
  )

  if (!result.ok) {
    return json({ error: 'unavailable' }, 503)
  }

  info('[UninstallFeedback] 已记录', {
    id: result.id,
    email: result.sinks.email,
    reasonCount: reasons.length
  })
  // 对用户：KV 成功即反馈成功；邮件是否 defer 不暴露为成败
  return json({ ok: true, id: result.id })
}

/** 供测试与官网选项同步 */
export { UNINSTALL_FEEDBACK_REASONS }
