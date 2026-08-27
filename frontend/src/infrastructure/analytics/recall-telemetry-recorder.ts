/**
 * Side Panel Recall TTE 会话录制器：维护 active task + 七事件写入。
 */

import type {
  RecallOutcomeConfidence,
  RecallOutcomeLabel,
  RecallOutcomeSource
} from '@/core/recall/recall-outcome'
import type { RecallPipelineTiming } from '@/core/recall/recall-telemetry'
import {
  previewRecallClue,
  RECALL_TTE_TASK_TIMEOUT_MS,
  type RecallTelemetryEvent
} from '@/core/recall/recall-telemetry'
import { appendRecallTelemetryEvent } from '@/infrastructure/analytics/recall-telemetry-store'

interface ActiveRecallTelemetryTask {
  taskId: string
  traceId: string
  querySubmittedAt: number
  timeoutTimer: ReturnType<typeof setTimeout> | null
}

function nowIso(): string {
  return new Date().toISOString()
}

/** 串行化 storage 追加，避免并发 read-modify-write 丢事件。 */
let appendChain: Promise<void> = Promise.resolve()

function emit(event: RecallTelemetryEvent): void {
  appendChain = appendChain
    .then(() => appendRecallTelemetryEvent(event))
    .catch(() => {
      // 忽略：埋点失败不挡 Recall
    })
}

/** 创建 Side Panel 用 TTE 录制器（组件内单例）。 */
export function createRecallTelemetryRecorder() {
  let active: ActiveRecallTelemetryTask | null = null

  function clearTimeoutTimer(): void {
    if (active?.timeoutTimer) {
      clearTimeout(active.timeoutTimer)
      active.timeoutTimer = null
    }
  }

  function clearActiveTask(): void {
    clearTimeoutTimer()
    active = null
  }

  function scheduleTaskTimeout(task: ActiveRecallTelemetryTask): void {
    clearTimeoutTimer()
    task.timeoutTimer = setTimeout(() => {
      if (active?.taskId !== task.taskId) {
        return
      }
      emit({
        type: 'task_timeout',
        taskId: task.taskId,
        traceId: task.traceId,
        timeoutMs: RECALL_TTE_TASK_TIMEOUT_MS,
        at: nowIso()
      })
    }, RECALL_TTE_TASK_TIMEOUT_MS)
  }

  /** 用户提交线索；若为多轮 refine 则先发 query_refined。 */
  function beginQuery(input: { clue: string; priorCluePreview?: string }): {
    taskId: string
    traceId: string
  } {
    clearActiveTask()
    const taskId = crypto.randomUUID()
    const traceId = taskId
    const cluePreview = previewRecallClue(input.clue)
    const at = nowIso()

    if (input.priorCluePreview?.trim()) {
      emit({
        type: 'query_refined',
        taskId,
        traceId,
        cluePreview,
        priorCluePreview: previewRecallClue(input.priorCluePreview),
        at
      })
    }

    emit({
      type: 'query_submitted',
      taskId,
      traceId,
      cluePreview,
      at
    })

    active = {
      taskId,
      traceId,
      querySubmittedAt: Date.now(),
      timeoutTimer: null
    }
    scheduleTaskTimeout(active)
    return { taskId, traceId }
  }

  /** Recall 响应渲染完成。 */
  function recordResultRendered(input: {
    outcome: 'top_pick' | 'need_a_clue' | 'no_match'
    resultCount: number
    pipelineTiming?: RecallPipelineTiming
  }): void {
    if (!active) {
      return
    }
    emit({
      type: 'result_rendered',
      taskId: active.taskId,
      traceId: active.traceId,
      outcome: input.outcome,
      resultCount: input.resultCount,
      ...(input.pipelineTiming ? { pipelineTiming: input.pipelineTiming } : {}),
      at: nowIso()
    })
  }

  /** 证据卡进入视口（DOM mount）。 */
  function recordEvidenceVisible(input: {
    memoryItemId: string
    rank: number
    ecs: number
    reasonCodes?: string[]
    anchor?: string
  }): void {
    if (!active) {
      return
    }
    emit({
      type: 'evidence_visible',
      taskId: active.taskId,
      traceId: active.traceId,
      memoryItemId: input.memoryItemId,
      rank: input.rank,
      ecs: input.ecs,
      ...(input.reasonCodes?.length ? { reasonCodes: input.reasonCodes } : {}),
      ...(input.anchor ? { anchor: input.anchor } : {}),
      at: nowIso()
    })
  }

  /** 用户 explore 打开来源。 */
  function recordSourceOpened(input: { memoryItemId: string; rank?: number }): void {
    if (!active) {
      return
    }
    emit({
      type: 'source_opened',
      taskId: active.taskId,
      traceId: active.traceId,
      memoryItemId: input.memoryItemId,
      ...(input.rank !== undefined ? { rank: input.rank } : {}),
      at: nowIso()
    })
  }

  /** Outcome 结算对齐 user_confirmed / 负向确认。 */
  function recordUserConfirmed(input: {
    label: RecallOutcomeLabel
    source: RecallOutcomeSource
    confidence?: RecallOutcomeConfidence
    memoryItemId?: string
  }): void {
    if (!active) {
      return
    }
    clearTimeoutTimer()
    emit({
      type: 'user_confirmed',
      taskId: active.taskId,
      traceId: active.traceId,
      label: input.label,
      source: input.source,
      ...(input.confidence ? { confidence: input.confidence } : {}),
      ...(input.memoryItemId ? { memoryItemId: input.memoryItemId } : {}),
      at: nowIso()
    })
  }

  function getActiveTaskId(): string | null {
    return active?.taskId ?? null
  }

  return {
    beginQuery,
    recordResultRendered,
    recordEvidenceVisible,
    recordSourceOpened,
    recordUserConfirmed,
    clearActiveTask,
    getActiveTaskId
  }
}

export type RecallTelemetryRecorder = ReturnType<typeof createRecallTelemetryRecorder>
