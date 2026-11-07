/**
 * Side Panel §7.0 可见进展 UI 态：揭示门限、阶段队列 pacing、等待快照。
 * 从 SidePanel.vue 机械抽出；行为与原文一致，不调阈值。
 */

import { computed, type ComputedRef, type Ref, ref } from 'vue'

import type { RecallWaitProgressSnapshot } from '@/core/recall/recall-telemetry'
import {
  advanceRecallVisibleProgress,
  messageKeyForUnderstandingWaitTier,
  RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS,
  RECALL_VISIBLE_PROGRESS_REVEAL_MS,
  RECALL_VISIBLE_PROGRESS_STAGE_MIN_DWELL_MS,
  selectUnderstandingWaitTier,
  shouldRevealRecallVisibleProgress,
  type RecallVisibleProgressStage
} from '@/core/recall/visible-progress'
import { t } from '@/infrastructure/i18n/t'

export type UseRecallVisibleProgressOptions = {
  /** 本轮召回是否在刷新（驱动 pending 文案 / 放弃遥测门）。 */
  isRecallRefreshing: Ref<boolean>
  /** 等待中放弃（关 Panel / 新找）写遥测。 */
  recordWaitAbandoned: (input: {
    reason: 'panel_close' | 'new_find'
    waitProgress: RecallWaitProgressSnapshot
  }) => void
}

export type UseRecallVisibleProgressResult = {
  recallProgressRequestId: Ref<string | null>
  recallProgressStartedAt: Ref<number>
  recallPendingSteps: ComputedRef<Array<{ label: string; active: boolean }>>
  recallPendingLabel: ComputedRef<string>
  clearRecallVisibleProgressUi: () => void
  startRecallVisibleProgressUi: (progressRequestId: string) => void
  enqueueRecallVisibleProgressStage: (stage: RecallVisibleProgressStage) => void
  enqueueMissingVisibleProgressStages: (
    stages: readonly RecallVisibleProgressStage[] | undefined
  ) => void
  finishRecallVisibleProgressUi: () => Promise<void>
  snapshotWaitProgress: () => RecallWaitProgressSnapshot
  recordVisibleProgressWaitAbandoned: (reason: 'panel_close' | 'new_find') => void
}

/** Side Panel 可见进展：慢请求才揭示阶段；结果回后排空队列再撤 pending。 */
export function useRecallVisibleProgress(
  options: UseRecallVisibleProgressOptions
): UseRecallVisibleProgressResult {
  const { isRecallRefreshing, recordWaitAbandoned } = options

  const recallProgressRequestId = ref<string | null>(null)
  const recallProgressStartedAt = ref(0)
  const recallProgressRevealed = ref(false)
  const recallProgressCurrent = ref<RecallVisibleProgressStage | null>(null)
  const recallProgressCompleted = ref<RecallVisibleProgressStage[]>([])
  /** 驱动 understanding 等待梯级文案随 elapsed 更新。 */
  const recallProgressNowMs = ref(0)
  let recallProgressRevealTimer: ReturnType<typeof setTimeout> | null = null
  let recallProgressTickTimer: ReturnType<typeof setInterval> | null = null
  /** 阶段展示队列：真实已发生，但 pacing 以免后两步一闪而过。 */
  const recallProgressStageQueue: RecallVisibleProgressStage[] = []
  let recallProgressQueueFlushing = false
  let recallProgressQueueWaiters: Array<() => void> = []

  function stopRecallProgressTick(): void {
    if (recallProgressTickTimer !== null) {
      clearInterval(recallProgressTickTimer)
      recallProgressTickTimer = null
    }
  }

  function startRecallProgressTick(): void {
    stopRecallProgressTick()
    recallProgressNowMs.value = Date.now()
    recallProgressTickTimer = setInterval(() => {
      recallProgressNowMs.value = Date.now()
    }, 400)
  }

  /** 当前 active 阶段文案 key（understanding 可升等待梯级）。 */
  function activeProgressMessageKey(stage: RecallVisibleProgressStage): string {
    if (stage === 'understanding') {
      const elapsed = Math.max(0, recallProgressNowMs.value - recallProgressStartedAt.value)
      return messageKeyForUnderstandingWaitTier(selectUnderstandingWaitTier(elapsed))
    }
    return RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS[stage]
  }

  function sleepMs(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  function settleRecallProgressQueueWaiters(): void {
    const waiters = recallProgressQueueWaiters
    recallProgressQueueWaiters = []
    for (const resolve of waiters) {
      resolve()
    }
  }

  function clearRecallVisibleProgressUi(): void {
    if (recallProgressRevealTimer !== null) {
      clearTimeout(recallProgressRevealTimer)
      recallProgressRevealTimer = null
    }
    stopRecallProgressTick()
    recallProgressStageQueue.length = 0
    recallProgressQueueFlushing = false
    settleRecallProgressQueueWaiters()
    recallProgressRequestId.value = null
    recallProgressStartedAt.value = 0
    recallProgressNowMs.value = 0
    recallProgressRevealed.value = false
    recallProgressCurrent.value = null
    recallProgressCompleted.value = []
  }

  function startRecallVisibleProgressUi(progressRequestId: string): void {
    clearRecallVisibleProgressUi()
    recallProgressRequestId.value = progressRequestId
    recallProgressStartedAt.value = Date.now()
    startRecallProgressTick()
    recallProgressRevealTimer = setTimeout(() => {
      if (recallProgressRequestId.value !== progressRequestId) {
        return
      }
      if (shouldRevealRecallVisibleProgress(Date.now() - recallProgressStartedAt.value)) {
        recallProgressRevealed.value = true
      }
    }, RECALL_VISIBLE_PROGRESS_REVEAL_MS)
  }

  function applyRecallVisibleProgressStageNow(stage: RecallVisibleProgressStage): void {
    const advanced = advanceRecallVisibleProgress(
      recallProgressCurrent.value,
      stage,
      recallProgressCompleted.value
    )
    recallProgressCurrent.value = advanced.current
    recallProgressCompleted.value = advanced.completed
    if (
      !recallProgressRevealed.value &&
      shouldRevealRecallVisibleProgress(Date.now() - recallProgressStartedAt.value)
    ) {
      recallProgressRevealed.value = true
    }
  }

  async function flushRecallVisibleProgressQueue(): Promise<void> {
    if (recallProgressQueueFlushing) {
      await new Promise<void>(resolve => {
        recallProgressQueueWaiters.push(resolve)
      })
      return
    }
    recallProgressQueueFlushing = true
    try {
      while (recallProgressStageQueue.length > 0) {
        const stage = recallProgressStageQueue.shift()
        if (!stage) {
          break
        }
        applyRecallVisibleProgressStageNow(stage)
        await sleepMs(RECALL_VISIBLE_PROGRESS_STAGE_MIN_DWELL_MS)
      }
    } finally {
      recallProgressQueueFlushing = false
      settleRecallProgressQueueWaiters()
    }
  }

  function enqueueRecallVisibleProgressStage(stage: RecallVisibleProgressStage): void {
    recallProgressStageQueue.push(stage)
    void flushRecallVisibleProgressQueue()
  }

  /** 结果带回的阶段列表：补上推送竞态丢失的后半段（不立刻 flush，交给 finish）。 */
  function enqueueMissingVisibleProgressStages(
    stages: readonly RecallVisibleProgressStage[] | undefined
  ): void {
    if (!stages || stages.length === 0) {
      return
    }
    const seen = new Set<RecallVisibleProgressStage>([
      ...recallProgressCompleted.value,
      ...(recallProgressCurrent.value ? [recallProgressCurrent.value] : []),
      ...recallProgressStageQueue
    ])
    for (const stage of stages) {
      if (seen.has(stage)) {
        continue
      }
      seen.add(stage)
      recallProgressStageQueue.push(stage)
    }
  }

  /** 结果已回：排空真实阶段队列后再撤 pending，避免只看见 understanding。 */
  async function finishRecallVisibleProgressUi(): Promise<void> {
    await flushRecallVisibleProgressQueue()
    clearRecallVisibleProgressUi()
  }

  const recallPendingSteps = computed(() => {
    if (!isRecallRefreshing.value || !recallProgressRevealed.value) {
      return []
    }
    // 依赖 tick，使 understanding 梯级文案随 elapsed 更新
    void recallProgressNowMs.value
    const steps: Array<{ label: string; active: boolean }> = []
    for (const stage of recallProgressCompleted.value) {
      steps.push({
        label: t(RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS[stage]),
        active: false
      })
    }
    if (recallProgressCurrent.value) {
      steps.push({
        label: t(activeProgressMessageKey(recallProgressCurrent.value)),
        active: true
      })
    }
    return steps
  })

  /** 本轮等待快照（放弃 / 出结果体验度量；与 §5.9 分计）。 */
  function snapshotWaitProgress(): RecallWaitProgressSnapshot {
    const startedAt = recallProgressStartedAt.value
    const elapsedMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0
    const peakStage =
      recallProgressCurrent.value ??
      (recallProgressCompleted.value.length > 0
        ? recallProgressCompleted.value[recallProgressCompleted.value.length - 1]
        : undefined)
    const understandingTier =
      recallProgressCurrent.value === 'understanding'
        ? selectUnderstandingWaitTier(elapsedMs)
        : undefined
    return {
      progressRevealed: recallProgressRevealed.value,
      waitElapsedMs: elapsedMs,
      ...(peakStage ? { peakStage } : {}),
      ...(understandingTier !== undefined ? { understandingTier } : {})
    }
  }

  /** 等待中放弃：关 Panel / 新找（改发 clue 由 beginClue 记 superseded）。 */
  function recordVisibleProgressWaitAbandoned(reason: 'panel_close' | 'new_find'): void {
    if (!isRecallRefreshing.value) {
      return
    }
    recordWaitAbandoned({
      reason,
      waitProgress: snapshotWaitProgress()
    })
  }

  const recallPendingLabel = computed(() => {
    if (!isRecallRefreshing.value) {
      return t('popup_recall_pending')
    }
    void recallProgressNowMs.value
    if (recallProgressRevealed.value && recallProgressCurrent.value) {
      return t(activeProgressMessageKey(recallProgressCurrent.value))
    }
    // <500ms：不展示阶段文案（仅脉冲）
    return ''
  })

  return {
    recallProgressRequestId,
    recallProgressStartedAt,
    recallPendingSteps,
    recallPendingLabel,
    clearRecallVisibleProgressUi,
    startRecallVisibleProgressUi,
    enqueueRecallVisibleProgressStage,
    enqueueMissingVisibleProgressStages,
    finishRecallVisibleProgressUi,
    snapshotWaitProgress,
    recordVisibleProgressWaitAbandoned
  }
}
