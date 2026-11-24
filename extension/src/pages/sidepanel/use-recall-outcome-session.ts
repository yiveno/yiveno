/**
 * Side Panel §7.2 Outcome 会话：出口条、dwell 收尾、结算 flush、miss 文案。
 * 从 SidePanel.vue 机械抽出；行为与原文一致。thread pivot 留壳。
 */

import { ref, type Ref } from 'vue'

import type { RecallMatch } from '@/core/recall/recall-result'
import type { RecallDegradedReason } from '@/core/recall/resolve-recall-degraded-reason'
import {
  getRecallShellNoMatchCopy,
  type RecallShellBookmarkFuel,
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
  bookmarkFuel: Ref<RecallShellBookmarkFuel>
  /**
   * 本机书签语料条数（`listMemoryItems({ type: 'bookmark' })` 的 total）。
   * `null` = 尚未探测或探测失败（不追加书签相关 miss 段）。
   */
  bookmarkCount: Ref<number | null>
  /**
   * 同步关时未进库书签数。
   * `null` = 未知（不追加 stale 段）。
   */
  unsyncedBookmarkCount: Ref<number | null>
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
  /** 出口条 Found it；可选 foundId 认领指定 open（须在 opens 内，否则回落最后一次）。 */
  handleOutcomeExitFound: (foundId?: string) => void
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
    /** intent=chitchat 时的模型原文回复；有则直接渲染 */
    assistantReply?: string
    /** 本轮 in-Recall 降级原因（调用方用 resolveRecallDegradedReason 算好） */
    degradedReason?: RecallDegradedReason
  }) => { text: string; textSegments?: RecallShellTextSegment[] }
  resetOutcomeSession: () => void
}

function joinMissSegments(segments: RecallShellTextSegment[]): string {
  return segments.map(segment => segment.text).join('')
}

/** Side Panel Outcome 会话：出口条 / dwell / flush / miss 文案。 */
export function useRecallOutcomeSession(
  options: UseRecallOutcomeSessionOptions
): UseRecallOutcomeSessionResult {
  const {
    bookmarkFuel,
    bookmarkCount,
    unsyncedBookmarkCount,
    recallTelemetry,
    onCompleteNewFindSession
  } = options

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

  /** 出口条：Found it（传 id 认领该条；不传或非法 id 回落最后一次 open）。 */
  function handleOutcomeExitFound(foundId?: string): void {
    const opens = outcomeSession.value.opens
    const lastId = opens.length > 0 ? opens[opens.length - 1]?.id : null
    const openIds = new Set(opens.map(open => open.id))
    const claimId =
      foundId !== undefined && foundId.length > 0 && openIds.has(foundId) ? foundId : lastId
    if (!claimId) {
      void onCompleteNewFindSession('exit_skip')
      return
    }
    outcomeSession.value = {
      ...outcomeSession.value,
      exitChoice: 'found',
      exitFoundId: claimId
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

  /** 出口条：跳过 → 无显式出口标签，落入 C1/C2 行为推断。 */
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
    /** intent=chitchat 时的模型原文回复；有则直接渲染 */
    assistantReply?: string
    /** 本轮 in-Recall 降级原因（调用方算好；专属 emptyKind / 空库不叠） */
    degradedReason?: RecallDegradedReason
  }): { text: string; textSegments?: RecallShellTextSegment[] } {
    if (input.emptyKind === 'rejected_noise') {
      return { text: t('popup_reply_miss_rejected_noise') }
    }
    if (input.emptyKind === 'chitchat' && input.assistantReply?.trim()) {
      return { text: input.assistantReply.trim() }
    }
    if (input.emptyKind === 'constrained_none') {
      return {
        text: input.hasRelatedGuess
          ? t('popup_followup_miss_constrained_empty_with_guess')
          : t('popup_followup_miss_constrained_empty')
      }
    }
    if (input.emptyKind === 'missing_topic') {
      return { text: t('popup_reply_miss_missing_topic') }
    }
    if (input.emptyKind === 'behavior_not_imported') {
      return {
        text: `${t('behavior_pref_not_imported')} ${t('behavior_pref_not_imported_link')}`,
        textSegments: [
          { kind: 'text', text: `${t('behavior_pref_not_imported')} ` },
          {
            kind: 'open_behavior_import_settings',
            text: t('behavior_pref_not_imported_link')
          }
        ]
      }
    }
    if (input.emptyKind === 'behavior_empty') {
      return { text: t('behavior_pref_empty') }
    }
    if (input.emptyKind === 'behavior_topic_unsupported' && input.assistantReply?.trim()) {
      return { text: input.assistantReply.trim() }
    }
    if (input.emptyKind === 'behavior_exhausted' && input.assistantReply?.trim()) {
      return { text: input.assistantReply.trim() }
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

    const baseText = input.usedRulesFallback
      ? t('popup_reply_miss_after_simpler_pass')
      : t('popup_reply_miss')

    // 通用 miss 追加段（仅 library ready）；降级 + 未导入/stale
    if (input.library !== 'ready') {
      return { text: baseText }
    }

    const segments: RecallShellTextSegment[] = [{ kind: 'text', text: `${baseText} ` }]
    let appended = false

    if (input.degradedReason === 'ai_off') {
      segments.push(
        { kind: 'text', text: t('popup_miss_degraded_ai_off_prefix') },
        { kind: 'open_ai_settings', text: t('popup_miss_degraded_ai_off_link') },
        // 后缀与书签未导入段共用（同「再回来找」口径）
        { kind: 'text', text: t('popup_miss_bookmarks_not_imported_suffix') }
      )
      appended = true
    } else if (input.degradedReason === 'not_signed_in') {
      segments.push(
        { kind: 'text', text: t('popup_miss_degraded_not_signed_in_prefix') },
        { kind: 'open_account_settings', text: t('popup_miss_degraded_not_signed_in_link') },
        { kind: 'text', text: t('popup_miss_bookmarks_not_imported_suffix') }
      )
      appended = true
    }

    // 库非空但书签语料为 0：追加导入/导入中说明（触发案例：youtube 找不到未导入书签）
    if (bookmarkCount.value === 0) {
      if (bookmarkFuel.value === 'ingest_off') {
        if (appended) {
          segments.push({ kind: 'text', text: ' ' })
        }
        segments.push(
          { kind: 'text', text: t('popup_miss_bookmarks_not_imported_prefix') },
          {
            kind: 'open_bookmark_ingest_settings',
            text: t('popup_empty_import_bookmarks')
          },
          { kind: 'text', text: t('popup_miss_bookmarks_not_imported_suffix') }
        )
        appended = true
      } else if (bookmarkFuel.value === 'importing') {
        if (appended) {
          segments.push({ kind: 'text', text: ' ' })
        }
        segments.push({ kind: 'text', text: t('popup_miss_bookmarks_importing') })
        appended = true
      }
      // ingest_on_empty：已开导入但本机无 Chrome 书签 → 不追加（「还没导入」是假话）
    }

    const unsynced = unsyncedBookmarkCount.value
    if (unsynced != null && unsynced > 0) {
      if (appended) {
        segments.push({ kind: 'text', text: ' ' })
      }
      segments.push(
        {
          kind: 'text',
          text: t('popup_miss_bookmarks_stale_prefix', [String(unsynced)])
        },
        {
          kind: 'open_bookmark_ingest_settings',
          text: t('popup_empty_import_bookmarks')
        },
        { kind: 'text', text: t('popup_miss_bookmarks_not_imported_suffix') }
      )
      appended = true
    }

    if (!appended) {
      return { text: baseText }
    }
    return { text: joinMissSegments(segments), textSegments: segments }
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
