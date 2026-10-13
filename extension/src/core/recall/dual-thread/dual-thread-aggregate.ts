/**
 * 暗线 · 匿名汇总草图（双线程观测口子）。
 * 从本机遥测等输入生成可入研究笔记的计数；剥离 clue / id / URL。
 */

import { z } from 'zod'

import type { RecallTelemetryEvent } from '@/core/recall/recall-telemetry'
import {
  RecallFailureStageSchema,
  type RecallFailureAttribution,
  type RecallFailureStage
} from '@/core/recall/dual-thread/recall-failure-attribution'
import { RECALL_ADAPTATION_CONFIG_VERSION } from '@/core/recall/dual-thread/recall-adaptation-config'

const emptyStageCounts = (): Record<RecallFailureStage, number> => ({
  not_captured: 0,
  index_gap: 0,
  candidate_miss: 0,
  understand_skew: 0,
  rank_wrong: 0,
  clue_insufficient: 0,
  absent_honest: 0,
  ux_friction: 0,
  unknown: 0
})

export const DualThreadAggregateSketchSchema = z.object({
  /** 草图生成时刻（ISO） */
  generatedAt: z.string().min(1),
  /** 适应配置表版本（登记表，非自动学习代数） */
  adaptationConfigVersion: z.string().min(1),
  /** 遥测事件条数（已剥离正文） */
  telemetryEventCount: z.number().int().nonnegative(),
  /** result_rendered.outcome 计数 */
  resultOutcomeCounts: z.record(z.string(), z.number().int().nonnegative()),
  /** user_confirmed.label 计数 */
  confirmLabelCounts: z.record(z.string(), z.number().int().nonnegative()),
  /** 手工归因 stage 计数（若调用方传入） */
  failureStageCounts: z.record(RecallFailureStageSchema, z.number().int().nonnegative()),
  /** pipelineTiming.totalMs 的粗分位（样本不足则为 null） */
  timingTotalMs: z
    .object({
      n: z.number().int().nonnegative(),
      p50: z.number().nonnegative().nullable(),
      p90: z.number().nonnegative().nullable()
    })
    .optional(),
  /** 纪律声明 */
  privacyNoteZh: z.string().min(1)
})

export type DualThreadAggregateSketch = z.infer<typeof DualThreadAggregateSketchSchema>

const PRIVACY_NOTE_ZH =
  '本草图仅含匿名计数与耗时分位；不含用户线索原文、条目标识或链接；不得据此宣称人脑规律（双线程 §3）。'

function percentileSorted(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? null
}

/**
 * 由遥测事件 + 可选手工归因列表构建匿名草图。
 */
export function buildDualThreadAggregateSketch(input: {
  events: readonly RecallTelemetryEvent[]
  attributions?: readonly RecallFailureAttribution[]
  nowIso?: string
}): DualThreadAggregateSketch {
  const resultOutcomeCounts: Record<string, number> = {}
  const confirmLabelCounts: Record<string, number> = {}
  const totals: number[] = []

  for (const ev of input.events) {
    if (ev.type === 'result_rendered') {
      resultOutcomeCounts[ev.outcome] = (resultOutcomeCounts[ev.outcome] ?? 0) + 1
      const total = ev.pipelineTiming?.totalMs
      if (typeof total === 'number') totals.push(total)
    }
    if (ev.type === 'user_confirmed') {
      confirmLabelCounts[ev.label] = (confirmLabelCounts[ev.label] ?? 0) + 1
    }
  }

  const failureStageCounts = emptyStageCounts()
  for (const attr of input.attributions ?? []) {
    failureStageCounts[attr.stage] += 1
  }

  totals.sort((a, b) => a - b)

  return DualThreadAggregateSketchSchema.parse({
    generatedAt: input.nowIso ?? new Date().toISOString(),
    adaptationConfigVersion: RECALL_ADAPTATION_CONFIG_VERSION,
    telemetryEventCount: input.events.length,
    resultOutcomeCounts,
    confirmLabelCounts,
    failureStageCounts,
    timingTotalMs: {
      n: totals.length,
      p50: percentileSorted(totals, 50),
      p90: percentileSorted(totals, 90)
    },
    privacyNoteZh: PRIVACY_NOTE_ZH
  })
}
