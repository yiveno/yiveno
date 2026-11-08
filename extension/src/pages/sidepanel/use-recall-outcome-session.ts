/**
 * Side Panel §7.2 Outcome 会话：出口条、dwell 收尾、结算 flush、miss 文案。
 * 从 SidePanel.vue 机械抽出；行为与原文一致。thread pivot 留壳。
 */

import { ref, type Ref } from 'vue'

import type { RecallMatch } from '@/core/recall/recall-result'
import {
  getRecallShellNoMatchCopy,
  resolveRecallShellBookmarkFuel,
  type RecallShellLibraryState,
  type RecallShellTextSegment
} from '@/core/recall/recall-shell-empty-copy'
import { t } from '@/infrastructure/i18n/t'
import {
  commitRecallOutcome,
  createRecallOutcomeSessionState,
  withFinalizedLastOpenDwell,
  type RecallOutcomeSessionState
} from '@/application/recall/commit-recall-outcome'
import type { createRecallTelemetryRecorder } from '@/infrastructure/analytics/recall-telemetry-recorder'

export type UseRecallOutcomeSessionOptions = {
  /** 空库 miss 文案燃料态（来自冷启动簇）。 */
  bookmarkFuel: Ref<ReturnType<typeof resolveRecallShellBookmarkFuel>>
  /** 与 Outcome 同寿的遥测录制器。 */
  recallTelemetry: ReturnType<typeof createRecallTelemetryRecorder>
  /**
   * 出口条确认后结算并开新找。
   * 壳可稍后改写（completeNewFindSession 定义之后）。
   */
  onCompleteNewFindSession: (reason: string) => void | Promise<void>
}

export type UseRecallOutcomeSessionResult = {
  outcomeSession: Ref<RecallOutcomeSessionState>
  showOutcomeExitStrip: Ref<boolean>
  pendingPrefillAfterExit: Ref<string | null>
  /** 关 Panel 结算只做一次。 */
  markOutcomeCloseHandled: () => boolean
  resetOutcomeCloseHandled: () => void
  handleOutcomeExitFound: () => void
  handleOutcomeExitNone: () => void
  handleOutcomeExitSkip: () => void
  finalizeOpenDwell: () => void
  flushOutcomeSession: (reason: string, sessionStopped: boolean) => Promise<void>
  collectResultIdsFromRecall: (result: {
    topPick: RecallMatch | null
    alsoPossible: RecallMatch[]
  }) => string[]
  resolveMissAssistantCopy: (input: {
    emptyKind?: string
    hasRelatedGuess: boolean
    library: RecallShellLibraryState
    clue: string
    usedRulesFallback?: boolean
  }) => { text: string; textSegments?: RecallShellTextSegment[] }
  resetOutcomeSession: () => void
}

/** Side Panel Outcome 会话：出口条 / dwell / flush / miss 文案。 */
export function useRecallOutcomeSession(
  options: UseRecallOutcomeSessionOptions
): UseRecallOutcomeSessionResult {
  const { bookmarkFuel, recallTelemetry, onCompleteNewFindSession } = options

  /** §7.2 Outcome 会话信号（与 dialog 同寿；关 Panel / New find 结算后重置）。 */
  const outcomeSession = ref<RecallOutcomeSessionState>(createRecallOutcomeSessionState())
  /** 出口条（通道 D）：仅同场 New find 前出示（不跨次打开补问）。 */
  const showOutcomeExitStrip = ref(false)
  /** 出口条出示期间暂存的 Omnibox 预填线索。 */
  const pendingPrefillAfterExit = ref<string | null>(null)
  /** 关 Panel 结算只做一次（onUnmounted）。 */
  let outcomeCloseHandled = false

  function markOutcomeCloseHandled(): boolean {
    if (outcomeCloseHandled) {
      return false
    }
    outcomeCloseHandled = true
    return true
  }

  function resetOutcomeCloseHandled(): void {
    outcomeCloseHandled = false
  }

  /** 出口条：Found it（默认最后一次 open）。 */
  function handleOutcomeExitFound(): void {
    const opens = outcomeSession.value.opens
    const lastId = opens.length > 0 ? opens[opens.length - 1]?.id : null
    if (!lastId) {
      void onCompleteNewFindSession('exit_skip')
      return
    }
    outcomeSession.value = {
      ...outcomeSession.value,
      exitChoice: 'found',
      exitFoundId: lastId
    }
    void onCompleteNewFindSession('exit_found')
  }

  /** 出口条：None of these。 */
  function handleOutcomeExitNone(): void {
    outcomeSession.value = {
      ...outcomeSession.value,
      exitChoice: 'none',
      exitFoundId: null
    }
    void onCompleteNewFindSession('exit_none')
  }

  /** 出口条：跳过 → unknown。 */
  function handleOutcomeExitSkip(): void {
    void onCompleteNewFindSession('exit_skip')
  }

  /** 给最后一次 explore open 补 dwell（C1/C2）。 */
  function finalizeOpenDwell(): void {
    outcomeSession.value = {
      ...outcomeSession.value,
      opens: withFinalizedLastOpenDwell(outcomeSession.value.opens)
    }
  }

  /** §7.2：结算当前 Outcome 会话（best-effort）。 */
  async function flushOutcomeSession(reason: string, sessionStopped: boolean): Promise<void> {
    finalizeOpenDwell()
    const state = outcomeSession.value
    const hasSignal =
      state.resultIds.length > 0 ||
      state.opens.length > 0 ||
      state.dismissedPending ||
      state.sawNoMatchFinal ||
      state.exitChoice !== null ||
      state.effectiveClue.trim().length > 0
    if (!hasSignal) {
      return
    }
    try {
      const result = await commitRecallOutcome({ state, sessionStopped, reason })
      if (result.settleWritten) {
        outcomeSession.value = {
          ...outcomeSession.value,
          settleWriteDone: true
        }
      }
      recallTelemetry.recordUserConfirmed({
        label: result.event.label,
        source: result.event.source,
        ...(result.event.confidence ? { confidence: result.event.confidence } : {}),
        ...(result.event.targetId ? { memoryItemId: result.event.targetId } : {})
      })
    } catch {
      // 忽略：结算失败不挡 New find / 关 Panel
    }
  }

  function collectResultIdsFromRecall(result: {
    topPick: RecallMatch | null
    alsoPossible: RecallMatch[]
  }): string[] {
    const ids: string[] = []
    if (result.topPick) {
      ids.push(result.topPick.item.id)
    }
    for (const match of result.alsoPossible) {
      ids.push(match.item.id)
    }
    return [...new Set(ids)]
  }

  /** 无候选 miss：诚实终局文案（无问卷芯片）；空库可带「导入」深链片段。 */
  function resolveMissAssistantCopy(input: {
    emptyKind?: string
    hasRelatedGuess: boolean
    library: RecallShellLibraryState
    clue: string
    /** 本轮 LLM 理解失败已降级规则时，空结果须绑定「简化理解」以免像单纯没找着 */
    usedRulesFallback?: boolean
  }): { text: string; textSegments?: RecallShellTextSegment[] } {
    if (input.emptyKind === 'rejected_noise') {
      return { text: t('popup_reply_miss_rejected_noise') }
    }
    if (input.emptyKind === 'constrained_none') {
      return {
        text: input.hasRelatedGuess
          ? t('popup_followup_miss_constrained_empty_with_guess')
          : t('popup_followup_miss_constrained_empty')
      }
    }
    if (input.library === 'empty') {
      const copy = getRecallShellNoMatchCopy(
        { library: 'empty', clue: input.clue, bookmarkFuel: bookmarkFuel.value },
        t
      )
      const titleAndBody: RecallShellTextSegment[] = [
        { kind: 'text', text: `${copy.title} ` },
        ...(copy.bodySegments ?? [{ kind: 'text' as const, text: copy.body }])
      ]
      return {
        text: `${copy.title} ${copy.body}`,
        ...(copy.bodySegments ? { textSegments: titleAndBody } : {})
      }
    }
    return {
      text: input.usedRulesFallback
        ? t('popup_reply_miss_after_simpler_pass')
        : t('popup_reply_miss')
    }
  }

  function resetOutcomeSession(): void {
    outcomeSession.value = createRecallOutcomeSessionState()
  }

  return {
    outcomeSession,
    showOutcomeExitStrip,
    pendingPrefillAfterExit,
    markOutcomeCloseHandled,
    resetOutcomeCloseHandled,
    handleOutcomeExitFound,
    handleOutcomeExitNone,
    handleOutcomeExitSkip,
    finalizeOpenDwell,
    flushOutcomeSession,
    collectResultIdsFromRecall,
    resolveMissAssistantCopy,
    resetOutcomeSession
  }
}
