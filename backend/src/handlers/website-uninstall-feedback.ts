/**
 * 扩展卸载落地页可选反馈：闭集原因 + 可选短留言；按 IP 限流后写入 AI_USAGE_KV。
 * 不绑定账号、不清 Memory、不踢官网登录；无分析后台。
 */

import { z } from 'zod'
import type { Env } from '../types/env'
import { info, warn, error as logErrorMessage, toLogError } from '../utils/logger'

/** 闭集卸载原因（与官网落地页选项同步） */
export const UNINSTALL_FEEDBACK_REASONS = [
  'didnt_find', // 没找到保存的东西
  'too_hard', // 难用 / 困惑
  'missing_feature', // 缺功能
  'privacy', // 隐私或权限顾虑
  'bugs_or_slow', // 卡顿 / bug
  'just_trying', // 只是试试
  'other' // 其它
] as const

export type UninstallFeedbackReason = (typeof UNINSTALL_FEEDBACK_REASONS)[number]

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
/** 反馈条目 KV 前缀 */
const FEEDBACK_KEY_PREFIX = 'uninstall_fb:'
/** 保留约 180 天（与隐私披露一致） */
const FEEDBACK_TTL_SECONDS = 180 * 24 * 60 * 60

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

  if (!env.AI_USAGE_KV) {
    logErrorMessage('[UninstallFeedback] AI_USAGE_KV 未绑定', {})
    return json({ error: 'unavailable' }, 503)
  }

  const ip = clientIp(request)
  if (await isRateLimited(env, ip)) {
    warn('[UninstallFeedback] IP 日限流', { ip })
    return json({ error: 'rate_limited' }, 429)
  }

  const id = crypto.randomUUID()
  const record = {
    id,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
    createdAt: new Date().toISOString()
  }

  info('[UninstallFeedback] 写入开始', {
    reason: record.reason,
    hasNote: Boolean(record.note)
  })

  try {
    await env.AI_USAGE_KV.put(`${FEEDBACK_KEY_PREFIX}${id}`, JSON.stringify(record), {
      expirationTtl: FEEDBACK_TTL_SECONDS
    })
  } catch (err) {
    logErrorMessage('[UninstallFeedback] KV 写入失败', { detail: toLogError(err) })
    return json({ error: 'unavailable' }, 503)
  }

  info('[UninstallFeedback] 写入成功', { reason: record.reason, id })
  return json({ ok: true })
}
