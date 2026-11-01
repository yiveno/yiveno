/**
 * §7.0 可见进展体验度量汇总（与 §5.9 TTE / Success@180 **分计**）。
 * 输入本机 `yiveno.recallTelemetry` 事件；禁止用输出宣称召回质量达标。
 */

import type { RecallTelemetryEvent } from '@/core/recall/recall-telemetry'

export type VisibleProgressTelemetrySummary = {
  /** 有 clue_submitted 的 task 数 */
  submittedTasks: number
  /** 有 result_rendered 的 task 数 */
  completedWithResult: number
  /** 有 wait_abandoned 且同 task 无 result_rendered */
  abandonedBeforeResult: number
  /** abandonedBeforeResult / submittedTasks；无提交则为 null */
  abandonRate: number | null
  /** 放弃时 progressRevealed=true */
  abandonedWhileProgressRevealed: number
  /** clue_refined 事件数（同线程改写） */
  refineEvents: number
  /** refineEvents / completedWithResult */
  refinePerCompletedTask: number | null
  byAbandonReason: {
    panel_close: number
    new_find: number
    superseded_clue: number
  }
  /** 出结果且曾揭示阶段 UI */
  resultsWithProgressRevealed: number
}

/** 汇总可见进展相关体验指标。 */
export function summarizeVisibleProgressTelemetry(
  events: readonly RecallTelemetryEvent[]
): VisibleProgressTelemetrySummary {
  const byTask = new Map<string, RecallTelemetryEvent[]>()
  for (const event of events) {
    const list = byTask.get(event.taskId) ?? []
    list.push(event)
    byTask.set(event.taskId, list)
  }

  let submittedTasks = 0
  let completedWithResult = 0
  let abandonedBeforeResult = 0
  let abandonedWhileProgressRevealed = 0
  let refineEvents = 0
  let resultsWithProgressRevealed = 0
  const byAbandonReason = {
    panel_close: 0,
    new_find: 0,
    superseded_clue: 0
  }

  for (const taskEvents of byTask.values()) {
    const submitted = taskEvents.some(event => event.type === 'clue_submitted')
    if (!submitted) {
      continue
    }
    submittedTasks += 1
    refineEvents += taskEvents.filter(event => event.type === 'clue_refined').length

    const rendered = taskEvents.find(event => event.type === 'result_rendered')
    if (rendered && rendered.type === 'result_rendered') {
      completedWithResult += 1
      if (rendered.waitProgress?.progressRevealed === true) {
        resultsWithProgressRevealed += 1
      }
      continue
    }

    const abandoned = [...taskEvents].reverse().find(event => event.type === 'wait_abandoned')
    if (abandoned && abandoned.type === 'wait_abandoned') {
      abandonedBeforeResult += 1
      byAbandonReason[abandoned.reason] += 1
      if (abandoned.waitProgress.progressRevealed) {
        abandonedWhileProgressRevealed += 1
      }
    }
  }

  return {
    submittedTasks,
    completedWithResult,
    abandonedBeforeResult,
    abandonRate: submittedTasks > 0 ? abandonedBeforeResult / submittedTasks : null,
    abandonedWhileProgressRevealed,
    refineEvents,
    refinePerCompletedTask: completedWithResult > 0 ? refineEvents / completedWithResult : null,
    byAbandonReason,
    resultsWithProgressRevealed
  }
}
