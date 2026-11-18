/**
 * 暗线匿名汇总草图仓储（Supabase service role · ADR-027）。
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseClient } from '../data-access/supabase'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

export type DualThreadSketchUpsertInput = {
  userId: string
  sketchDate: string // YYYY-MM-DD（UTC）
  generatedAt: string
  adaptationConfigVersion: string
  telemetryEventCount: number
  resultOutcomeCounts: Record<string, number>
  confirmLabelCounts: Record<string, number>
  failureStageCounts: Record<string, number>
  timingTotalMs: Record<string, unknown> | null
}

function requireClient(env: Env): SupabaseClient {
  const client = createSupabaseClient(env)
  if (!client) {
    throw new Error('supabase_not_configured')
  }
  return client
}

/** 同日 (user_id, sketch_date) upsert；返回 sketch_date。 */
export async function upsertDualThreadSketch(
  env: Env,
  input: DualThreadSketchUpsertInput
): Promise<{ sketchDate: string }> {
  const supabase = requireClient(env)
  const row = {
    user_id: input.userId,
    sketch_date: input.sketchDate,
    generated_at: input.generatedAt,
    adaptation_config_version: input.adaptationConfigVersion,
    telemetry_event_count: input.telemetryEventCount,
    result_outcome_counts: input.resultOutcomeCounts,
    confirm_label_counts: input.confirmLabelCounts,
    failure_stage_counts: input.failureStageCounts,
    timing_total_ms: input.timingTotalMs
  }

  const { error } = await supabase.from('dual_thread_sketches').upsert(row, {
    onConflict: 'user_id,sketch_date'
  })

  if (error) {
    logErrorMessage('[DualThread] upsert 失败', {
      detail: error.message,
      userId: input.userId,
      sketchDate: input.sketchDate
    })
    throw new Error('dual_thread_sketch_upsert_failed')
  }

  info('[DualThread] upsert 草图', {
    userId: input.userId,
    sketchDate: input.sketchDate,
    telemetryEventCount: input.telemetryEventCount
  })
  return { sketchDate: input.sketchDate }
}

/** 删除该用户全部已贡献草图；返回删除行数。 */
export async function deleteAllDualThreadSketchesForUser(
  env: Env,
  userId: string
): Promise<{ deletedCount: number }> {
  const supabase = requireClient(env)

  const { data, error } = await supabase
    .from('dual_thread_sketches')
    .delete()
    .eq('user_id', userId)
    .select('id')

  if (error) {
    logErrorMessage('[DualThread] deleteAll 失败', {
      detail: error.message,
      userId
    })
    throw new Error('dual_thread_sketch_delete_failed')
  }

  const deletedCount = Array.isArray(data) ? data.length : 0
  info('[DualThread] 已删除用户草图', { userId, deletedCount })
  return { deletedCount }
}
