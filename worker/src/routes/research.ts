/**
 * 暗线研究接收端（匿名汇总草图 · ADR-027）。
 * 鉴权：Supabase Bearer（仅登录，无 Pro 门禁）；数据面经 service role。
 */

import { Hono } from 'hono'
import { z } from 'zod'

import {
  deleteAllDualThreadSketchesForUser,
  upsertDualThreadSketch
} from '../data-access/dual-thread-sketches'
import { supabaseAuth } from '../middleware/supabase-auth'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

type ResearchVars = {
  Bindings: Env
  Variables: {
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

export const researchRouter = new Hono<ResearchVars>()

researchRouter.use('*', supabaseAuth())

/** 与扩展 DualThreadAggregateSketchSchema 同形（Worker 不可 import 扩展）。 */
export const DualThreadAggregateSketchBodySchema = z
  .object({
    generatedAt: z.string().min(1),
    adaptationConfigVersion: z.string().min(1),
    telemetryEventCount: z.number().int().nonnegative(),
    resultOutcomeCounts: z.record(z.string(), z.number().int().nonnegative()),
    confirmLabelCounts: z.record(z.string(), z.number().int().nonnegative()),
    failureStageCounts: z.record(z.string(), z.number().int().nonnegative()),
    timingTotalMs: z
      .object({
        n: z.number().int().nonnegative(),
        p50: z.number().nonnegative().nullable(),
        p90: z.number().nonnegative().nullable()
      })
      .optional(),
    privacyNoteZh: z.string().min(1)
  })
  .strict()

export type DualThreadAggregateSketchBody = z.infer<typeof DualThreadAggregateSketchBodySchema>

/** 隐私硬线：拒绝含原文/自由文本偷渡的 payload。 */
const FORBIDDEN_BODY_KEYS = new Set(['cluePreview', 'anchor'])

/**
 * 解析并校验草图 body；隐私字段或 schema 非法时返回错误码。
 * 导出供单测对账，不依赖 HTTP。
 */
export function parseResearchSketchBody(
  raw: unknown
):
  | { ok: true; data: DualThreadAggregateSketchBody }
  | { ok: false; error: 'privacy_field_forbidden'; field: string }
  | { ok: false; error: 'invalid_payload'; issues?: z.ZodIssue[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'invalid_payload' }
  }
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      return { ok: false, error: 'privacy_field_forbidden', field: key }
    }
  }
  const parsed = DualThreadAggregateSketchBodySchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_payload', issues: parsed.error.issues }
  }
  return { ok: true, data: parsed.data }
}

/** UTC 当天 YYYY-MM-DD。 */
export function utcSketchDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** JSON 响应助手（handler 与路由共用，避免 mock.module 污染鉴权单测）。 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

/**
 * POST 业务体（已鉴权）：校验 body → upsert 当天行。
 * 导出供单测直调，不经 supabaseAuth。
 */
export async function handleResearchSketchPost(
  env: Env,
  userId: string,
  raw: unknown
): Promise<Response> {
  const parsed = parseResearchSketchBody(raw)
  if (!parsed.ok) {
    if (parsed.error === 'privacy_field_forbidden') {
      info('[Research] 拒绝含隐私字段的草图', { userId, field: parsed.field })
      return jsonResponse({ error: 'privacy_field_forbidden', field: parsed.field }, 400)
    }
    return jsonResponse(
      {
        error: 'invalid_payload',
        ...(parsed.issues ? { issues: parsed.issues } : {})
      },
      400
    )
  }

  const sketchDate = utcSketchDate()
  try {
    const result = await upsertDualThreadSketch(env, {
      userId,
      sketchDate,
      generatedAt: parsed.data.generatedAt,
      adaptationConfigVersion: parsed.data.adaptationConfigVersion,
      telemetryEventCount: parsed.data.telemetryEventCount,
      resultOutcomeCounts: parsed.data.resultOutcomeCounts,
      confirmLabelCounts: parsed.data.confirmLabelCounts,
      failureStageCounts: parsed.data.failureStageCounts,
      timingTotalMs: parsed.data.timingTotalMs ?? null
    })
    info('[Research] 草图已接收', {
      userId,
      sketchDate: result.sketchDate,
      telemetryEventCount: parsed.data.telemetryEventCount
    })
    return jsonResponse({ success: true, data: { sketchDate: result.sketchDate } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Research] sketch upsert 异常', { detail: msg, userId })
    return jsonResponse(
      {
        error:
          msg === 'supabase_not_configured' || msg === 'dual_thread_sketch_upsert_failed'
            ? msg
            : 'research_sketch_failed'
      },
      500
    )
  }
}

/**
 * DELETE 业务体（已鉴权）：清空该用户草图。
 * 导出供单测直调，不经 supabaseAuth。
 */
export async function handleResearchSketchDelete(env: Env, userId: string): Promise<Response> {
  try {
    const result = await deleteAllDualThreadSketchesForUser(env, userId)
    info('[Research] 已清空用户草图', { userId, deletedCount: result.deletedCount })
    return jsonResponse({ success: true, data: { deletedCount: result.deletedCount } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logErrorMessage('[Research] sketch delete 异常', { detail: msg, userId })
    return jsonResponse(
      {
        error:
          msg === 'supabase_not_configured' || msg === 'dual_thread_sketch_delete_failed'
            ? msg
            : 'research_sketch_delete_failed'
      },
      500
    )
  }
}

/** POST /api/research/sketch — 接收草图，upsert 当天一行 */
researchRouter.post('/sketch', async c => {
  const userId = c.get('supabaseUserId')
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_payload' }, 400)
  }
  return handleResearchSketchPost(c.env, userId, raw)
})

/** DELETE /api/research/sketch — 删除该用户全部已贡献草图 */
researchRouter.delete('/sketch', async c => {
  const userId = c.get('supabaseUserId')
  return handleResearchSketchDelete(c.env, userId)
})
