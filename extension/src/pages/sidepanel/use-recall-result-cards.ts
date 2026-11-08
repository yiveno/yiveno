/**
 * Side Panel 结果卡交互：Show more、重复组折叠、打开原文、证据可见、dismiss。
 * 从 SidePanel.vue 机械抽出；须读/写壳响应式态，故为组合函数（非纯 helper）。
 * 纯派生见 recall-result-card-helpers.ts。
 */

import { nextTick, type ComputedRef, type Ref, ref } from 'vue'

import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { resolveNextRecallVisibleCount } from '@/core/recall/recall-result-visible-count'
import type { RecallDialogState } from '@/core/recall/merge-recall-dialog-turn'
import { commitRecallOutcome } from '@/application/recall/commit-recall-outcome'
import type { RecallOutcomeSessionState } from '@/application/recall/commit-recall-outcome'
import {
  navigateActiveTab,
  recordMemoryOpen,
  recordRecallDismiss
} from '@/infrastructure/messaging/background-client'
import { markFirstRecallOpenDone } from '@/infrastructure/storage/first-recall-onboarding-storage'
import { t } from '@/infrastructure/i18n/t'
import type { createRecallTelemetryRecorder } from '@/infrastructure/analytics/recall-telemetry-recorder'
import type { ConversationTurn, AssistantTurn } from '@/pages/sidepanel/recall-conversation-types'
import {
  formatRankedReplyText,
  renderFramingWithShownCount,
  visibleCandidateCards
} from '@/pages/sidepanel/recall-result-card-helpers'

export type UseRecallResultCardsOptions = {
  conversationTurns: Ref<ConversationTurn[]>
  dialogState: Ref<RecallDialogState>
  outcomeSession: Ref<RecallOutcomeSessionState>
  clue: Ref<string>
  errorMessage: Ref<string>
  clueInputRef: Ref<{ focus?: () => void } | null>
  threadFindTitleDisplay: ComputedRef<string | null>
  recallTelemetry: ReturnType<typeof createRecallTelemetryRecorder>
  finalizeOpenDwell: () => void
  nextTurnId: () => string
}

export type UseRecallResultCardsResult = {
  expandedDuplicateGroupId: Ref<string | null>
  handleShowMoreMatches: (turnId: string, mode?: 'page' | 'all') => void
  toggleDuplicateGroup: (cardId: string) => void
  handleCardOpen: (payload: {
    id: string
    url: string
    openInNewTab: boolean
    rank?: number
  }) => void
  handleEvidenceVisible: (payload: {
    memoryItemId: string
    rank: number
    ecs: number
    reasonCodes?: string[]
    anchor?: string
  }) => void
  handleDismissCandidates: () => Promise<void>
  handleRecallResultOpen: (
    memoryItemId: string,
    openUrl: string,
    openInNewTab?: boolean,
    rank?: number
  ) => void
}

/** Side Panel 结果卡交互（须 shell 响应式态）。 */
export function useRecallResultCards(
  options: UseRecallResultCardsOptions
): UseRecallResultCardsResult {
  const {
    conversationTurns,
    dialogState,
    outcomeSession,
    clue,
    errorMessage,
    clueInputRef,
    threadFindTitleDisplay,
    recallTelemetry,
    finalizeOpenDwell,
    nextTurnId
  } = options

  /** 当前展开的重复组代表 id；同时只展开一组。 */
  const expandedDuplicateGroupId = ref<string | null>(null)

  /** Show more：再展一页或展开剩余全部，并刷新文案区间。 */
  function handleShowMoreMatches(turnId: string, mode: 'page' | 'all' = 'page'): void {
    conversationTurns.value = conversationTurns.value.map(turn => {
      if (turn.role !== 'assistant' || turn.id !== turnId) {
        return turn
      }
      const total = turn.candidateCards?.length ?? 0
      if (total === 0) {
        return turn
      }
      const currentVisible = turn.visibleCount ?? RECALL_RESULT_PAGE_SIZE
      const nextVisible = resolveNextRecallVisibleCount(currentVisible, total, mode)
      const rankedTotal = turn.rankedTotalCount ?? total
      const omitUnderstood = (turn.understandingEcho?.length ?? 0) > 0
      const hasCards =
        Boolean(turn.primaryCard) ||
        Boolean(turn.relatedGuessCard) ||
        (turn.candidateCards?.length ?? 0) > 0
      const nextText =
        turn.recallFramingFacts !== undefined
          ? renderFramingWithShownCount(turn.recallFramingFacts, rankedTotal, nextVisible, {
              omitUnderstood,
              omitCounts: hasCards
            })
          : hasCards
            ? turn.text
            : turn.tone === 'confident'
              ? formatRankedReplyText(rankedTotal, nextVisible)
              : turn.text
      return {
        ...turn,
        visibleCount: nextVisible,
        ...(turn.tone === 'confident' || turn.recallFramingFacts !== undefined
          ? { text: nextText }
          : {})
      }
    })
  }

  function toggleDuplicateGroup(cardId: string): void {
    expandedDuplicateGroupId.value = expandedDuplicateGroupId.value === cardId ? null : cardId
  }

  function handleCardOpen(payload: {
    id: string
    url: string
    openInNewTab: boolean
    rank?: number
  }): void {
    handleRecallResultOpen(payload.id, payload.url, payload.openInNewTab, payload.rank)
  }

  function handleEvidenceVisible(payload: {
    memoryItemId: string
    rank: number
    ecs: number
    reasonCodes?: string[]
    anchor?: string
  }): void {
    recallTelemetry.recordEvidenceVisible(payload)
  }

  /** 「都不是这些」：写否定反馈，保留 accumulated，会话 dismissedIds 并集后再请补线索。 */
  async function handleDismissCandidates(): Promise<void> {
    const lastAssistant = [...conversationTurns.value]
      .reverse()
      .find((turn): turn is AssistantTurn => turn.role === 'assistant' && turn.allowDismiss)

    if (!lastAssistant) {
      return
    }

    const ids = [
      ...(lastAssistant.primaryCard ? [lastAssistant.primaryCard.id] : []),
      ...visibleCandidateCards(lastAssistant).map(c => c.id)
    ]

    if (ids.length > 0) {
      dialogState.value = {
        ...dialogState.value,
        dismissedIds: [...new Set([...dialogState.value.dismissedIds, ...ids])]
      }
      outcomeSession.value = {
        ...outcomeSession.value,
        dismissedPending: true,
        sawNoMatchFinal: false,
        resultIds: ids
      }
      void recordRecallDismiss({ ids }).catch(() => {
        // 忽略：反馈失败不阻塞继续补线索
      })
      void commitRecallOutcome({
        state: outcomeSession.value,
        reason: 'dismiss'
      })
        .then(result => {
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
        })
        .catch(() => {
          // 忽略：Outcome 日志失败不挡 dismiss
        })
    }

    conversationTurns.value = conversationTurns.value.map(turn => {
      if (turn.role === 'assistant' && turn.id === lastAssistant.id) {
        return { ...turn, allowDismiss: false }
      }
      return turn
    })

    conversationTurns.value.push({
      id: nextTurnId(),
      role: 'user',
      text: t('popup_dismiss_candidates')
    })

    conversationTurns.value.push({
      id: nextTurnId(),
      role: 'assistant',
      tone: 'miss',
      text: t('popup_reply_after_dismiss'),
      contextStatus: threadFindTitleDisplay.value
        ? t('popup_session_status_continuing_threaded', threadFindTitleDisplay.value)
        : t('popup_session_status_continuing'),
      allowDismiss: false
    })

    errorMessage.value = ''
    clue.value = ''
    await nextTick()
    clueInputRef.value?.focus?.()
  }

  /** 打开结果：默认当前活动标签；⌘/Ctrl+点击新开。写 explore open（§7.2：≠ settled）。 */
  function handleRecallResultOpen(
    memoryItemId: string,
    openUrl: string,
    openInNewTab = false,
    rank?: number
  ): void {
    recallTelemetry.recordSourceOpened({
      memoryItemId,
      ...(rank !== undefined ? { rank } : {})
    })
    void markFirstRecallOpenDone().catch(() => {
      // 忽略：引导标记失败不影响打开
    })
    finalizeOpenDwell()
    outcomeSession.value = {
      ...outcomeSession.value,
      opens: [...outcomeSession.value.opens, { id: memoryItemId, at: new Date().toISOString() }]
    }
    void navigateActiveTab({
      url: openUrl,
      disposition: openInNewTab ? 'newForegroundTab' : 'currentTab'
    }).catch(() => {
      // 忽略：导航失败不打断会话；用户可再点
    })
    if (openUrl.includes('/detail.html')) {
      return
    }
    void recordMemoryOpen({ id: memoryItemId }).catch(() => {
      // 忽略：打开记录失败不影响用户跳转
    })
  }

  return {
    expandedDuplicateGroupId,
    handleShowMoreMatches,
    toggleDuplicateGroup,
    handleCardOpen,
    handleEvidenceVisible,
    handleDismissCandidates,
    handleRecallResultOpen
  }
}
