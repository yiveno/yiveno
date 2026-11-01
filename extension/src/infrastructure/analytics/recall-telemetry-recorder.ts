/**
 * Side Panel Recall 遥测录制器：TTE 七事件 + §7.0 等待放弃（体验 · 与 TTE 分计）。
 */

import type {
  RecallOutcomeConfidence,
  RecallOutcomeLabel,
  RecallOutcomeSource
} from '@/core/recall/recall-outcome'
import type {
  RecallPipelineTiming,
  RecallWaitAbandonReason,
  RecallWaitProgressSnapshot,
  RecallTelemetryEvent
} from '@/core/recall/recall-telemetry'
import { previewRecallClue, RECALL_TTE_TASK_TIMEOUT_MS } from '@/core/recall/recall-telemetry'
import { appendRecallTelemetryEvent } from '@/infrastructure/analytics/recall-telemetry-store'

interface ActiveRecallTelemetryTask {
  taskId: string
  traceId: string
  clueSubmittedAt: number
  timeoutTimer: ReturnType<typeof setTimeout> | null
  /** 本 task 是否已写出结果（防重复 wait_abandoned） */
  resultRendered: boolean
  /** 是否已记过等待放弃 */
  waitAbandoned: boolean
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

function defaultWaitProgressSnapshot(clueSubmittedAt: number): RecallWaitProgressSnapshot {
  return {
    progressRevealed: false,
    waitElapsedMs: Math.max(0, Date.now() - clueSubmittedAt)
  }
}

/** 创建 Side Panel 用遥测录制器（组件内单例）。 */
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

  /**
   * 等待中放弃（关 Panel / 新找 / 改发 clue）。
   * 已出结果或已记过放弃则 no-op。
   */
  function recordWaitAbandoned(input: {
    reason: RecallWaitAbandonReason
    waitProgress?: RecallWaitProgressSnapshot
  }): void {
    if (!active || active.resultRendered || active.waitAbandoned) {
      return
    }
    const waitProgress = input.waitProgress ?? defaultWaitProgressSnapshot(active.clueSubmittedAt)
    active.waitAbandoned = true
    clearTimeoutTimer()
    emit({
      type: 'wait_abandoned',
      taskId: active.taskId,
      traceId: active.traceId,
      reason: input.reason,
      waitProgress,
      at: nowIso()
    })
  }

  /** 用户提交 clue；若为多轮 refine 则先发 clue_refined。 */
  function beginClue(input: {
    clue: string
    priorCluePreview?: string
    /** 覆盖上一段未出结果的等待（改发 clue） */
    supersedeWaitProgress?: RecallWaitProgressSnapshot
  }): {
    taskId: string
    traceId: string
  } {
    if (active && !active.resultRendered && !active.waitAbandoned) {
      recordWaitAbandoned({
        reason: 'superseded_clue',
        ...(input.supersedeWaitProgress ? { waitProgress: input.supersedeWaitProgress } : {})
      })
    }
    clearActiveTask()
    const taskId = crypto.randomUUID()
    const traceId = taskId
    const cluePreview = previewRecallClue(input.clue)
    const at = nowIso()

    if (input.priorCluePreview?.trim()) {
      emit({
        type: 'clue_refined',
        taskId,
        traceId,
        cluePreview,
        priorCluePreview: previewRecallClue(input.priorCluePreview),
        at
      })
    }

    emit({
      type: 'clue_submitted',
      taskId,
      traceId,
      cluePreview,
      at
    })

    active = {
      taskId,
      traceId,
      clueSubmittedAt: Date.now(),
      timeoutTimer: null,
      resultRendered: false,
      waitAbandoned: false
    }
    scheduleTaskTimeout(active)
    return { taskId, traceId }
  }

  /** Recall 响应渲染完成。 */
  function recordResultRendered(input: {
    outcome: 'top_pick' | 'need_a_clue' | 'no_match'
    resultCount: number
    pipelineTiming?: RecallPipelineTiming
    waitProgress?: RecallWaitProgressSnapshot
  }): void {
    if (!active) {
      return
    }
    active.resultRendered = true
    emit({
      type: 'result_rendered',
      taskId: active.taskId,
      traceId: active.traceId,
      outcome: input.outcome,
      resultCount: input.resultCount,
      ...(input.pipelineTiming ? { pipelineTiming: input.pipelineTiming } : {}),
      ...(input.waitProgress ? { waitProgress: input.waitProgress } : {}),
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
    beginClue,
    recordResultRendered,
    recordEvidenceVisible,
    recordSourceOpened,
    recordUserConfirmed,
    recordWaitAbandoned,
    clearActiveTask,
    getActiveTaskId
  }
}
