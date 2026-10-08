<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'

import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'
import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import {
  shouldShowColdStartGate,
  shouldShowColdStartPostReleaseBanner,
  COLD_START_POST_RELEASE_BANNER_TTL_MS,
  type ColdStartPipelineState
} from '@/core/memory/cold-start-pipeline-state'
import {
  coldStartEnrichmentBatchProgressRatio,
  type ColdStartEnrichmentBatch
} from '@/core/memory/cold-start-enrichment-batch'
import { shouldShowCaptureFirstRecallShell } from '@/core/capture/install-onboarding'
import {
  getRecallShellIdleEmptyCopy,
  getRecallShellNoMatchCopy,
  type RecallShellLibraryState
} from '@/core/recall/recall-shell-empty-copy'
import { getTimeOfDayGreeting } from '@/core/recall/time-of-day-greeting'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { resolveNextRecallVisibleCount } from '@/core/recall/recall-result-visible-count'
import { computeComposerPlaceholder } from '@/core/recall/compute-composer-placeholder'
import { extractComposerNarrowExamples } from '@/core/recall/extract-composer-narrow-examples'
import { resolveThreadFindTitle } from '@/core/recall/resolve-thread-anchor-label'
import {
  collectThreadAnchorTerms,
  shouldOfferThreadPivotConfirm
} from '@/core/recall/should-offer-thread-pivot-confirm'
import { renderRecallFraming } from '@/core/recall/render-recall-framing'
import type { RecallFramingFacts } from '@/core/recall/recall-framing-facts'
import {
  listIdleClueParadigmSpecs,
  shouldShowIdleClueParadigms
} from '@/core/recall/idle-clue-paradigms'
import {
  formatRecallUnderstandingEchoChips,
  recallUnderstandingEchoSourceFromParsed
} from '@/core/recall/format-recall-understanding-echo'
import { formatRecallVisibleProgressBasis } from '@/core/recall/format-recall-visible-progress-basis'
import { selectRecallVisibleProgressBasisKinds } from '@/core/recall/visible-progress-basis'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import {
  advanceRecallVisibleProgress,
  RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS,
  RECALL_VISIBLE_PROGRESS_REVEAL_MS,
  RECALL_VISIBLE_PROGRESS_STAGE_MIN_DWELL_MS,
  shouldRevealRecallVisibleProgress,
  type RecallVisibleProgressStage
} from '@/core/recall/visible-progress'
import { parseRecallVisibleProgressMessage } from '@/core/messaging/ui-messages'
import { tRecallError } from '@/infrastructure/i18n/background-error'
import { openGettingStartedPage } from '@/infrastructure/browser/getting-started-page'
import { t } from '@/infrastructure/i18n/t'
import {
  readColdStartPostReleaseBannerDismissedReadyAt,
  writeColdStartPostReleaseBannerDismissedReadyAt
} from '@/infrastructure/storage/cold-start-post-release-banner-storage'
import {
  cancelRecall,
  fetchAuthState,
  fetchChromeBookmarkImportStatus,
  fetchColdStartStatus,
  listMemoryItems,
  navigateActiveTab,
  recallWithClue,
  recordMemoryOpen,
  recordRecallDismiss
} from '@/infrastructure/messaging/background-client'
import {
  consumeRecallPrefill,
  consumeRecallPrefillWithRetry,
  markFirstRecallOpenDone,
  readExcerptCaptureCount,
  RECALL_PREFILL_SESSION_KEY
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import {
  markInstallOnboardingDone,
  readInstallOnboardingDone
} from '@/infrastructure/storage/install-onboarding-storage'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import DetailExportBar from '@/infrastructure/ui/DetailExportBar.vue'
import DetailExportBarDock from '@/infrastructure/ui/DetailExportBarDock.vue'
import AppToastHost from '@/infrastructure/ui/AppToastHost.vue'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'
import {
  copyDetailExportToClipboard,
  downloadDetailExport
} from '@/infrastructure/recall/detail-export-client'
import { toggleDetailExportSelection as toggleDetailExportSelectionSet } from '@/infrastructure/recall/detail-export-selection'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'
import { type RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import RecallConversation from '@/pages/sidepanel/components/RecallConversation.vue'
import RecallComposer from '@/pages/sidepanel/components/RecallComposer.vue'
import ColdStartGate from '@/pages/sidepanel/components/ColdStartGate.vue'
import { createAssistantTurn } from '@/pages/sidepanel/build-assistant-turn'
import type { ConversationTurn, AssistantTurn } from '@/pages/sidepanel/recall-conversation-types'
import {
  createRecallShellScrollListener,
  scheduleRecallShellScrollToBottom
} from '@/pages/sidepanel/recall-shell-scroll'
import type { RecallDialogState } from '@/core/recall/merge-recall-dialog-turn'
import {
  commitRecallOutcome,
  createRecallOutcomeSessionState,
  shouldOfferRecallOutcomeExitPrompt,
  withFinalizedLastOpenDwell,
  type RecallOutcomeSessionState
} from '@/application/recall/commit-recall-outcome'
import { createRecallTelemetryRecorder } from '@/infrastructure/analytics/recall-telemetry-recorder'
import { toRecallMatchCard } from '@/pages/sidepanel/recall-match-card'

defineOptions({ name: 'SidePanelPage' })

const recallDetailPageUrl = chrome.runtime.getURL('detail.html')

const clue = ref('')
const clueInputRef = ref<InstanceType<typeof RecallComposer> | null>(null)
/** 有旧结果时后台刷新，避免拆掉列表 DOM。 */
const isRecallRefreshing = ref(false)
/** §7.0 可见进展：本轮 progressRequestId 与阶段（慢请求才揭示）。 */
const recallProgressRequestId = ref<string | null>(null)
const recallProgressStartedAt = ref(0)
const recallProgressRevealed = ref(false)
const recallProgressCurrent = ref<RecallVisibleProgressStage | null>(null)
const recallProgressCompleted = ref<RecallVisibleProgressStage[]>([])
let recallProgressRevealTimer: ReturnType<typeof setTimeout> | null = null
/** 阶段展示队列：真实已发生，但 pacing 以免后两步一闪而过。 */
const recallProgressStageQueue: RecallVisibleProgressStage[] = []
let recallProgressQueueFlushing = false
let recallProgressQueueWaiters: Array<() => void> = []
const errorMessage = ref('')

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
  recallProgressStageQueue.length = 0
  recallProgressQueueFlushing = false
  settleRecallProgressQueueWaiters()
  recallProgressRequestId.value = null
  recallProgressStartedAt.value = 0
  recallProgressRevealed.value = false
  recallProgressCurrent.value = null
  recallProgressCompleted.value = []
}

function startRecallVisibleProgressUi(progressRequestId: string): void {
  clearRecallVisibleProgressUi()
  recallProgressRequestId.value = progressRequestId
  recallProgressStartedAt.value = Date.now()
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
  const steps: Array<{ label: string; active: boolean }> = []
  for (const stage of recallProgressCompleted.value) {
    steps.push({
      label: t(RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS[stage]),
      active: false
    })
  }
  if (recallProgressCurrent.value) {
    steps.push({
      label: t(RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS[recallProgressCurrent.value]),
      active: true
    })
  }
  return steps
})

const recallPendingLabel = computed(() => {
  if (!isRecallRefreshing.value) {
    return t('popup_recall_pending')
  }
  if (recallProgressRevealed.value && recallProgressCurrent.value) {
    return t(RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS[recallProgressCurrent.value])
  }
  // &lt;500ms：不展示阶段文案（仅脉冲）
  return ''
})

const importState = ref<ChromeBookmarkImportState | null>(null)
const coldStartState = ref<ColdStartPipelineState | null>(null)
/** 本轮冷启动 LLM enrichment 批次进度。 */
const coldStartEnrichmentBatch = ref<ColdStartEnrichmentBatch | null>(null)
/** 本会话关闭放行后轻条时绑定的 readyAt。 */
const coldStartPostReleaseDismissedReadyAt = ref<string | null>(null)
/** 驱动轻条 TTL 到期重算。 */
const coldStartBannerNowMs = ref(Date.now())
let coldStartBannerExpiryTimer: ReturnType<typeof setTimeout> | null = null
/**
 * Getting Started Try it 预填：门禁未放行时挂起，ready 后再自动提交（§5.8.1 首召质量）。
 */
const pendingGsPrefillRecall = ref<string | null>(null)
const libraryState = ref<RecallShellLibraryState>('unknown')
const excerptCaptureCount = ref(0)
const installOnboardingDone = ref(true)
const skipOnboardingBusy = ref(false)
const lastSentClue = ref('')
/** 登录展示名；未登录或无名则空，问候退化为仅时段。 */
const accountDisplayName = ref('')

/** Side Panel 会话：槽位 accumulated + 本会话否定 id（关闭 Panel 即丢，P0）。 */
const dialogState = ref<RecallDialogState>({
  priorUserUtterances: [],
  accumulated: null,
  dismissedIds: []
})

/** §7.2 Outcome 会话信号（与 dialog 同寿；关 Panel / New find 结算后重置）。 */
const outcomeSession = ref<RecallOutcomeSessionState>(createRecallOutcomeSessionState())
/** §5.9 TTE 七事件本机录制（与 Outcome 会话同寿）。 */
const recallTelemetry = createRecallTelemetryRecorder()
/** 出口条（通道 D）：仅同场 New find 前出示（不跨次打开补问）。 */
const showOutcomeExitStrip = ref(false)
/** 出口条出示期间暂存的 Omnibox 预填线索。 */
const pendingPrefillAfterExit = ref<string | null>(null)
/** 关 Panel 结算只做一次（onUnmounted）。 */
let outcomeCloseHandled = false

/** 软岔路口：发送前确认 Keep refining / Start new。 */
const showThreadPivotStrip = ref(false)
/** 待确认的线索（确认条出示期间暂存）。 */
const pendingPivotClue = ref<string | null>(null)
/** 上次成功提交线索的时间（冷却启发式）。 */
const lastSubmitAtMs = ref<number | null>(null)

const conversationTurns = ref<ConversationTurn[]>([])
let turnSeq = 0

const recallBodyRef = ref<HTMLElement | null>(null)
/** 靠近底部时跟随新消息；用户上翻后暂停。 */
const stickToBottom = ref(true)

/** 有气泡或 dialog 槽位时视为活动线程（可 New find）。 */
const hasActiveFindSession = computed(() => {
  const d = dialogState.value
  return (
    conversationTurns.value.length > 0 ||
    d.priorUserUtterances.length > 0 ||
    d.accumulated !== null ||
    d.dismissedIds.length > 0
  )
})

const isComposerProminent = computed(() => conversationTurns.value.length === 0)

/** 本场找回会话标题（composer 锚点 / status / 软岔路口共用）。 */
const threadFindTitle = computed(() =>
  resolveThreadFindTitle({
    priorUserUtterances: dialogState.value.priorUserUtterances,
    contentTerms: dialogState.value.accumulated?.contentTerms ?? []
  })
)

const threadTitleAria = computed(() => {
  const title = threadFindTitle.value
  return title ? t('popup_thread_title_aria', title) : null
})

/** §7.0 双通道：按最新助手轮 + grounded 举例选择 placeholder。 */
const composerPlaceholder = computed(() => {
  const turns = conversationTurns.value
  let latestAssistant: AssistantTurn | null = null
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i]
    if (turn && turn.role === 'assistant') {
      latestAssistant = turn
      break
    }
  }

  const isIdle = latestAssistant === null
  const chipsPresent = Boolean(
    latestAssistant?.suggestions && latestAssistant.suggestions.length > 0
  )
  const pool = latestAssistant?.candidateCards ?? []
  const fromResult = latestAssistant?.composerNarrowExamples
  const narrowExamples =
    !isIdle && !chipsPresent
      ? fromResult && fromResult.length > 0
        ? fromResult
        : pool.length > 0
          ? extractComposerNarrowExamples({
              candidates: pool,
              clueText: lastSentClue.value
            })
          : []
      : []

  const result = computeComposerPlaceholder({
    isIdle,
    rankedTotalCount: latestAssistant?.rankedTotalCount ?? 0,
    chipsPresent,
    ...(latestAssistant?.tone !== undefined ? { assistantTone: latestAssistant.tone } : {}),
    ...(narrowExamples.length > 0 ? { narrowExamples } : {}),
    ...(threadFindTitle.value ? { threadLabel: threadFindTitle.value } : {})
  })

  if (result.messageArgs.length === 0) {
    return t(result.messageKey)
  }
  return t(result.messageKey, result.messageArgs)
})

const recallShellScrollListener = createRecallShellScrollListener(nearBottom => {
  stickToBottom.value = nearBottom
})

function scrollRecallToBottom(): void {
  scheduleRecallShellScrollToBottom(
    () => recallBodyRef.value,
    () => stickToBottom.value
  )
}

watch(
  () => [conversationTurns.value.length, isRecallRefreshing.value] as const,
  async () => {
    await nextTick()
    scrollRecallToBottom()
  }
)

function nextTurnId(): string {
  turnSeq += 1
  return String(turnSeq)
}

/** 续找时附带 session status；首轮 / 新会话后首轮不带。 */
function continuingContextStatus(
  priorUtterances: string[],
  accumulated: RecallDialogState['accumulated'],
  dismissedIds: string[]
): { contextStatus?: string } {
  const continuing = priorUtterances.length > 0 || accumulated !== null || dismissedIds.length > 0
  if (!continuing) {
    return {}
  }
  const label = resolveThreadFindTitle({
    priorUserUtterances: priorUtterances,
    contentTerms: accumulated?.contentTerms ?? []
  })
  return {
    contextStatus: label
      ? t('popup_session_status_continuing_threaded', label)
      : t('popup_session_status_continuing')
  }
}

/** 关闭软岔路口确认条并丢弃暂存线索。 */
function clearThreadPivotStrip(): void {
  showThreadPivotStrip.value = false
  pendingPivotClue.value = null
}

/** 用户显式开新找：若需出口条则先出示；否则结算并清空。 */
function startNewFindSession(): void {
  if (!hasActiveFindSession.value) {
    return
  }
  if (showOutcomeExitStrip.value) {
    return
  }
  finalizeOpenDwell()
  if (shouldOfferRecallOutcomeExitPrompt(outcomeSession.value)) {
    showOutcomeExitStrip.value = true
    return
  }
  void completeNewFindSession('new_find')
}

/** 结算 Outcome 并重置会话 UI。 */
async function completeNewFindSession(reason: string): Promise<void> {
  showOutcomeExitStrip.value = false
  clearThreadPivotStrip()
  await flushOutcomeSession(reason, true)
  recallRequestId += 1
  isRecallRefreshing.value = false
  clearRecallVisibleProgressUi()
  dialogState.value = {
    priorUserUtterances: [],
    accumulated: null,
    dismissedIds: []
  }
  outcomeSession.value = createRecallOutcomeSessionState()
  recallTelemetry.clearActiveTask()
  conversationTurns.value = []
  clue.value = ''
  lastSentClue.value = ''
  lastSubmitAtMs.value = null
  errorMessage.value = ''
  expandedDuplicateGroupId.value = null
  clearDetailExportSelection()
  stickToBottom.value = true
  const pendingPrefill = pendingPrefillAfterExit.value
  pendingPrefillAfterExit.value = null
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
  if (pendingPrefill) {
    clue.value = pendingPrefill
    void handleSendTurn(pendingPrefill, { skipPivotCheck: true })
  }
}

/** 出口条：Found it（默认最后一次 open）。 */
function handleOutcomeExitFound(): void {
  const opens = outcomeSession.value.opens
  const lastId = opens.length > 0 ? opens[opens.length - 1]?.id : null
  if (!lastId) {
    void completeNewFindSession('exit_skip')
    return
  }
  outcomeSession.value = {
    ...outcomeSession.value,
    exitChoice: 'found',
    exitFoundId: lastId
  }
  void completeNewFindSession('exit_found')
}

/** 出口条：None of these。 */
function handleOutcomeExitNone(): void {
  outcomeSession.value = {
    ...outcomeSession.value,
    exitChoice: 'none',
    exitFoundId: null
  }
  void completeNewFindSession('exit_none')
}

/** 出口条：跳过 → unknown。 */
function handleOutcomeExitSkip(): void {
  void completeNewFindSession('exit_skip')
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

/** 无候选 miss：诚实终局文案（无问卷芯片）。 */
function resolveMissAssistantText(input: {
  emptyKind?: string
  hasRelatedGuess: boolean
  library: RecallShellLibraryState
  clue: string
}): string {
  if (input.emptyKind === 'constrained_none') {
    return input.hasRelatedGuess
      ? t('popup_followup_miss_constrained_empty_with_guess')
      : t('popup_followup_miss_constrained_empty')
  }
  if (input.library === 'empty') {
    const copy = getRecallShellNoMatchCopy({ library: 'empty', clue: input.clue }, t)
    return `${copy.title} ${copy.body}`
  }
  return t('popup_reply_miss')
}

let importPollTimer: ReturnType<typeof setInterval> | null = null
let coldStartPollTimer: ReturnType<typeof setInterval> | null = null
/** 递增以丢弃过期找回响应，避免慢请求覆盖新线索结果。 */
let recallRequestId = 0

const showColdStartGate = computed(() => {
  if (coldStartState.value?.status === 'ready') {
    return false
  }
  if (shouldShowColdStartGate(coldStartState.value)) {
    return true
  }
  // 首次引导未完成且门禁未就绪：pipeline 尚未落盘时也先挡主壳（修复重装后只见 Capture-first）
  if (!installOnboardingDone.value && coldStartState.value === null) {
    return true
  }
  // pipeline 尚未落盘时：导入已在跑则仍挡主壳
  const importStatus = importState.value?.status
  return coldStartState.value === null && (importStatus === 'running' || importStatus === 'pending')
})

/** 门禁已放行时冲刷 GS / Omnibox 预填自动 Recall。 */
function tryFlushPendingGsPrefillRecall(): void {
  if (showColdStartGate.value) {
    return
  }
  const pending = pendingGsPrefillRecall.value
  if (!pending) {
    return
  }
  pendingGsPrefillRecall.value = null
  clue.value = pending
  void handleSendTurn(pending, { skipPivotCheck: true })
}

/** 挂起预填并在门禁放行后自动提交（GS Try it / Omnibox 无命中接力）。 */
function applyRecallPrefillClue(prefill: string): void {
  clue.value = prefill
  pendingGsPrefillRecall.value = prefill
  tryFlushPendingGsPrefillRecall()
}

/**
 * Panel 已开时仍接收新的 `yiveno.recallPrefill`（Omnibox → Side Panel 接力）。
 * 只消费 session 写入；清除 / 空串忽略。
 */
function handleRecallPrefillStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== 'session') {
    return
  }
  const change = changes[RECALL_PREFILL_SESSION_KEY]
  if (!change || typeof change.newValue !== 'string') {
    return
  }
  if (!change.newValue.trim()) {
    return
  }
  void (async () => {
    try {
      const prefill = await consumeRecallPrefill()
      if (!prefill) {
        return
      }
      applyRecallPrefillClue(prefill)
    } catch {
      // 忽略：预填消费失败不挡主壳
    }
  })()
}

watch(showColdStartGate, (blocked, wasBlocked) => {
  if (wasBlocked && !blocked) {
    tryFlushPendingGsPrefillRecall()
  }
})

/** 门禁展示用状态：优先 pipeline；否则用 import / 首装占位。 */
const coldStartGateState = computed((): ColdStartPipelineState | null => {
  if (coldStartState.value) {
    return coldStartState.value
  }
  const imp = importState.value
  if (imp && (imp.status === 'running' || imp.status === 'pending')) {
    return {
      version: 1,
      status: 'running',
      stage: 'import',
      importImportedCount: imp.importedCount,
      ...(imp.totalCount !== undefined ? { importTotalCount: imp.totalCount } : {}),
      rulesScanned: 0,
      rulesUpdated: 0,
      aiEmbedAttempted: 0,
      aiEmbedWritten: 0,
      aiLlmEnqueued: 0
    }
  }
  if (showColdStartGate.value) {
    return {
      version: 1,
      status: 'pending',
      stage: 'idle',
      importImportedCount: 0,
      rulesScanned: 0,
      rulesUpdated: 0,
      aiEmbedAttempted: 0,
      aiEmbedWritten: 0,
      aiLlmEnqueued: 0
    }
  }
  return null
})

/** 门禁已放行：后台加厚轻条（不挡 Recall）。 */
const showColdStartPostReleaseBanner = computed(() => {
  if (showColdStartGate.value) {
    return false
  }
  return shouldShowColdStartPostReleaseBanner({
    state: coldStartState.value,
    nowMs: coldStartBannerNowMs.value,
    dismissedReadyAt: coldStartPostReleaseDismissedReadyAt.value,
    enrichmentBatch: coldStartEnrichmentBatch.value
  })
})

const coldStartEnrichmentProgressRatio = computed(() => {
  const batch = coldStartEnrichmentBatch.value
  if (!batch || batch.total <= 0) {
    return 0
  }
  return coldStartEnrichmentBatchProgressRatio(batch)
})

const coldStartPostReleaseBannerLabel = computed(() => {
  const batch = coldStartEnrichmentBatch.value
  if (batch?.status === 'paused_quota') {
    return t('cold_start_post_release_banner_paused', [String(batch.settled), String(batch.total)])
  }
  if (batch && batch.total > 0 && batch.status === 'running') {
    return t('cold_start_post_release_banner_progress', [
      String(batch.settled),
      String(batch.total)
    ])
  }
  return t('cold_start_post_release_banner')
})

const showColdStartEnrichmentProgressBar = computed(() => {
  const batch = coldStartEnrichmentBatch.value
  return Boolean(batch && batch.total > 0 && batch.status !== 'cleared')
})

/** 书签 bulk 是否在跑（空态文案 / Capture-first；主进度 UI 在 Getting Started）。 */
const isImporting = computed(() => importState.value?.status === 'running')

/** 书签库存：导入计数；库已 ready 且无摘录计数时视为至少有书签可召（防 Capture-first 误伤）。 */
const captureFirstBookmarkCount = computed(() => {
  const imported = importState.value?.importedCount ?? 0
  if (imported > 0) {
    return imported
  }
  if (libraryState.value === 'ready' && excerptCaptureCount.value === 0) {
    return 1
  }
  return 0
})

const captureFirstMode = computed(() =>
  shouldShowCaptureFirstRecallShell({
    excerptCaptureCount: excerptCaptureCount.value,
    bookmarkCount: captureFirstBookmarkCount.value,
    installOnboardingDone: installOnboardingDone.value
  })
)

const idleEmptyCopy = computed(() =>
  getRecallShellIdleEmptyCopy(libraryState.value, isImporting.value, t, {
    captureFirst: captureFirstMode.value
  })
)

/** Idle 口语范式：库 ready + 非 Capture-first；推荐句式，填入不自动发。 */
const showIdleClueParadigms = computed(() =>
  shouldShowIdleClueParadigms({
    hasConversationTurns: conversationTurns.value.length > 0,
    captureFirst: captureFirstMode.value,
    library: libraryState.value
  })
)

const idleClueParadigmButtons = computed(() =>
  listIdleClueParadigmSpecs().map(spec => {
    const clueText = t(spec.clueMessageKey)
    return {
      id: spec.id,
      clue: clueText,
      ariaLabel: t('popup_idle_paradigm_fill_aria', clueText)
    }
  })
)

/** 空线程时占位问候：按时段，有名则带名。 */
const idleGreeting = computed(() =>
  getTimeOfDayGreeting(t, {
    ...(accountDisplayName.value ? { displayName: accountDisplayName.value } : {})
  })
)

/** 当前展开的重复组代表 id；同时只展开一组。 */
const expandedDuplicateGroupId = ref<string | null>(null)

const selectedDetailExportIds = ref<Set<string>>(new Set())
/** Detail export 多选模式：默认关，点 Export 后才显示勾选框。 */
const detailExportMode = ref(false)
const detailExportExporting = ref(false)

const { success: showToastSuccess, error: showToastError } = useAppToast()

const detailExportSelectedCount = computed(() => selectedDetailExportIds.value.size)
const showDetailExportBar = computed(() => detailExportMode.value)

/** 当前线程是否有可导出的结果卡（非空态 / 纯追问）。 */
const hasRecallResultCards = computed(() =>
  conversationTurns.value.some(turn => {
    if (turn.role !== 'assistant') {
      return false
    }
    return Boolean(
      turn.primaryCard || turn.relatedGuessCard || (turn.candidateCards?.length ?? 0) > 0
    )
  })
)

function enterDetailExportMode(): void {
  detailExportMode.value = true
}

function exitDetailExportMode(): void {
  detailExportMode.value = false
  selectedDetailExportIds.value = new Set()
}

function handleToggleDetailExportSelection(id: string): void {
  selectedDetailExportIds.value = toggleDetailExportSelectionSet(selectedDetailExportIds.value, id)
}

function clearDetailExportSelection(): void {
  exitDetailExportMode()
}

async function runDetailExportAction(
  format: 'json' | 'markdown',
  channel: 'copy' | 'download'
): Promise<void> {
  if (detailExportExporting.value) {
    return
  }
  detailExportExporting.value = true
  try {
    const ids = [...selectedDetailExportIds.value]
    const result =
      channel === 'copy'
        ? await copyDetailExportToClipboard(ids, format)
        : await downloadDetailExport(ids, format)
    if (!result.ok) {
      showToastError(tMemoryError(result.errorCode))
      return
    }
    showToastSuccess(
      channel === 'copy' ? t('detail_export_copy_success') : t('detail_export_download_success')
    )
    const firstId = ids[0]
    if (firstId) {
      outcomeSession.value = {
        ...outcomeSession.value,
        copiedOrPackedId: firstId
      }
    }
  } catch {
    showToastError(t('error_detail_export_operation_failed'))
  } finally {
    detailExportExporting.value = false
  }
}

/** 助手轮次当前可见的候选卡（Show more 截取）。 */
function visibleCandidateCards(turn: AssistantTurn): RecallCardModel[] {
  const cards = turn.candidateCards ?? []
  const limit = turn.visibleCount ?? cards.length
  return cards.slice(0, Math.max(0, limit))
}

/** 排序短名单回复文案：报总数 N，并标明当前展示区间。 */
function formatRankedReplyText(total: number, visible: number): string {
  if (total <= 0) {
    return t('popup_reply_confident')
  }
  const shown = Math.min(visible, total)
  if (shown >= total) {
    return t('popup_reply_ranked_all', [String(total)])
  }
  return t('popup_reply_ranked_partial', [String(total), '1', String(shown)])
}

/** 有真实槽位时生成理解回声芯片；无则 undefined。 */
function resolveUnderstandingEchoChips(parsed: ParsedRecallClue | undefined): string[] | undefined {
  const source = recallUnderstandingEchoSourceFromParsed(parsed)
  if (!source) {
    return undefined
  }
  const chips = formatRecallUnderstandingEchoChips(source, t)
  return chips.length > 0 ? chips : undefined
}

/** 列表级 Framing 文案；有理解回声时省略 P1 / 「主要依据」，避免重复。 */
function resolveListReplyText(
  result: RecallResult,
  total: number,
  visibleCount: number,
  fallback: string,
  options: { omitUnderstood?: boolean } = {}
): { text: string; recallFramingFacts?: RecallFramingFacts } {
  const omitUnderstood = options.omitUnderstood === true
  const facts = result.recallFraming?.facts
  let text: string
  if (facts) {
    text = renderFramingWithShownCount(facts, total, visibleCount, { omitUnderstood })
  } else if (result.recallFraming?.text.trim() && !omitUnderstood) {
    text = result.recallFraming.text
  } else {
    text = fallback
  }

  // 理解回声已展示具体槽位时，不再追加泛化「Mainly based on」
  if (!omitUnderstood) {
    const framingForBasis = facts ?? result.recallFraming?.facts
    const basisKinds = selectRecallVisibleProgressBasisKinds({
      ...(result.parsed !== undefined ? { parsed: result.parsed } : {}),
      ...(framingForBasis !== undefined ? { framingFacts: framingForBasis } : {})
    })
    const basis = formatRecallVisibleProgressBasis(basisKinds, t)
    if (basis) {
      text = `${text} ${basis}`
    }
  }

  if (facts) {
    return { text, recallFramingFacts: facts }
  }
  if (result.recallFraming?.facts) {
    return { text, recallFramingFacts: result.recallFraming.facts }
  }
  return { text }
}

function renderFramingWithShownCount(
  facts: RecallFramingFacts,
  total: number,
  shown: number,
  options: { omitUnderstood?: boolean } = {}
): string {
  if (facts.kind !== 'candidates') {
    return renderRecallFraming(facts, t, options)
  }
  return renderRecallFraming(
    {
      ...facts,
      counts: { total, shown: Math.min(shown, total) }
    },
    t,
    options
  )
}

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
    const nextText =
      turn.recallFramingFacts !== undefined
        ? renderFramingWithShownCount(turn.recallFramingFacts, rankedTotal, nextVisible, {
            omitUnderstood
          })
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

function toMatchCard(
  match: RecallMatch,
  resultClue: string,
  options: { includeSiblings?: boolean; rank?: number } = {}
): RecallCardModel {
  return toRecallMatchCard(match, resultClue, t, {
    ...options,
    detailPageUrl: recallDetailPageUrl
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
    contextStatus: threadFindTitle.value
      ? t('popup_session_status_continuing_threaded', threadFindTitle.value)
      : t('popup_session_status_continuing'),
    allowDismiss: false
  })

  errorMessage.value = ''
  clue.value = ''
  await nextTick()
  clueInputRef.value?.focus()
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

async function loadOnboardingState(): Promise<void> {
  try {
    const [captureCount, onboardingDone] = await Promise.all([
      readExcerptCaptureCount(),
      readInstallOnboardingDone()
    ])
    excerptCaptureCount.value = captureCount
    installOnboardingDone.value = onboardingDone
  } catch {
    // 忽略：默认不展示 Capture-first，避免阻塞 Side Panel 首屏
  }
}

/** 读取展示名供空态问候；无展示名时用邮箱本地段。失败不阻塞主路径。 */
async function loadGreetingIdentity(): Promise<void> {
  try {
    const response = await fetchAuthState()
    if (!response.ok) {
      accountDisplayName.value = ''
      return
    }
    const fromProfile = response.displayName?.trim() ?? ''
    if (fromProfile) {
      accountDisplayName.value = fromProfile
      return
    }
    const email = response.email?.trim() ?? ''
    const localPart = email.includes('@') ? email.slice(0, email.indexOf('@')).trim() : ''
    accountDisplayName.value = localPart
  } catch {
    accountDisplayName.value = ''
  }
}

async function handleSkipOnboarding(): Promise<void> {
  if (skipOnboardingBusy.value) {
    return
  }
  skipOnboardingBusy.value = true
  try {
    await markInstallOnboardingDone()
    installOnboardingDone.value = true
  } finally {
    skipOnboardingBusy.value = false
  }
}

function handleOpenGettingStarted(): void {
  void openGettingStartedPage()
}

async function probeMemoryLibrary() {
  try {
    const response = await listMemoryItems({ limit: 1 })
    if (!response.ok || !('total' in response)) {
      libraryState.value = 'unknown'
      return
    }
    libraryState.value = response.total > 0 ? 'ready' : 'empty'
  } catch {
    libraryState.value = 'unknown'
  }
}

async function refreshImportStatus() {
  const response = await fetchChromeBookmarkImportStatus()
  if (!response.ok) {
    return
  }
  importState.value = response.state

  // 无持久化记录视为终态：从未启动过导入 / 外部清掉 storage 都不该让 Side Panel 持续敲
  if (
    !response.state ||
    response.state.status === 'completed' ||
    response.state.status === 'failed'
  ) {
    stopImportPolling()
    if (response.state?.status === 'completed') {
      void probeMemoryLibrary()
    }
  }
}

function startImportPolling() {
  if (importPollTimer) {
    return
  }
  void refreshImportStatus()
  importPollTimer = setInterval(() => {
    void refreshImportStatus()
  }, 500)
}

function stopImportPolling() {
  if (importPollTimer) {
    clearInterval(importPollTimer)
    importPollTimer = null
  }
}

async function refreshColdStartStatus() {
  const response = await fetchColdStartStatus()
  if (!response.ok) {
    return
  }
  coldStartState.value = response.state
  coldStartEnrichmentBatch.value = response.enrichmentBatch
  scheduleColdStartPostReleaseBannerExpiry()
  tryFlushPendingGsPrefillRecall()
  const batchActive =
    response.enrichmentBatch?.status === 'running' &&
    response.enrichmentBatch.settled < response.enrichmentBatch.total
  if (response.state?.status === 'ready' || response.state?.status === 'failed') {
    if (!batchActive) {
      stopColdStartPolling()
    } else if (!coldStartPollTimer) {
      startColdStartPolling()
    }
    if (response.state.status === 'ready') {
      void probeMemoryLibrary()
    }
  }
}

function clearColdStartPostReleaseBannerExpiry() {
  if (coldStartBannerExpiryTimer) {
    clearTimeout(coldStartBannerExpiryTimer)
    coldStartBannerExpiryTimer = null
  }
}

/** 轻条仍在 TTL 内（且无活跃批次）时预约到期刷新。 */
function scheduleColdStartPostReleaseBannerExpiry() {
  clearColdStartPostReleaseBannerExpiry()
  coldStartBannerNowMs.value = Date.now()
  const state = coldStartState.value
  const readyAt = state?.readyAt
  if (!state || state.status !== 'ready' || !readyAt) {
    return
  }
  if (
    !shouldShowColdStartPostReleaseBanner({
      state,
      nowMs: coldStartBannerNowMs.value,
      dismissedReadyAt: coldStartPostReleaseDismissedReadyAt.value,
      enrichmentBatch: coldStartEnrichmentBatch.value
    })
  ) {
    return
  }
  // 有真实批次进行中：靠轮询更新，不靠 TTL 定时器
  const batch = coldStartEnrichmentBatch.value
  if (batch && (batch.status === 'running' || batch.status === 'paused_quota')) {
    return
  }
  const readyMs = Date.parse(readyAt)
  if (!Number.isFinite(readyMs)) {
    return
  }
  const remaining = readyMs + COLD_START_POST_RELEASE_BANNER_TTL_MS - coldStartBannerNowMs.value
  if (remaining <= 0) {
    return
  }
  coldStartBannerExpiryTimer = setTimeout(() => {
    coldStartBannerNowMs.value = Date.now()
    coldStartBannerExpiryTimer = null
  }, remaining + 50)
}

async function dismissColdStartPostReleaseBanner() {
  const readyAt = coldStartState.value?.readyAt
  if (readyAt) {
    coldStartPostReleaseDismissedReadyAt.value = readyAt
    try {
      await writeColdStartPostReleaseBannerDismissedReadyAt(readyAt)
    } catch {
      // 会话写失败仍本地隐藏
    }
  } else {
    // 无 readyAt 时用本地强制隐藏（不应出现；兜底）
    coldStartPostReleaseDismissedReadyAt.value = '__force_hidden__'
  }
  clearColdStartPostReleaseBannerExpiry()
}

function startColdStartPolling() {
  if (coldStartPollTimer) {
    return
  }
  void refreshColdStartStatus()
  coldStartPollTimer = setInterval(() => {
    void refreshColdStartStatus()
  }, 400)
}

function stopColdStartPolling() {
  if (coldStartPollTimer) {
    clearInterval(coldStartPollTimer)
    coldStartPollTimer = null
  }
}

async function runRecall(trimmedClue: string): Promise<void> {
  const trimmed = trimmedClue.trim()
  if (!trimmed) {
    isRecallRefreshing.value = false
    clearRecallVisibleProgressUi()
    errorMessage.value = ''
    return
  }

  const requestId = ++recallRequestId
  // recallId 用于 SW 端 activeRecallId 追踪；同 source 新 recall 自动覆盖，旧 in-flight 早退。
  // 与 requestId 共用同一递增计数器（语义一致：UI 端「当前 recall」= SW 端「活动 recall」）。
  const recallId = `sp-${requestId}`
  const progressRequestId = `sp-${requestId}-${Date.now()}`
  // 显式 cancel 旧 in-flight（同 clue 重复 Enter / 改 clue 提交 / Side Panel 关闭）。
  // SW 端 setActiveRecall 已覆盖，但主动 cancel 让旧 LLM 在 guard 处更早返回。
  if (requestId > 1) {
    void cancelRecall({ source: 'sidepanel', recallId: `sp-${requestId - 1}` }).catch(() => {})
  }
  errorMessage.value = ''
  isRecallRefreshing.value = true
  startRecallVisibleProgressUi(progressRequestId)

  const priorUserUtterances = [...dialogState.value.priorUserUtterances]
  const accumulated = dialogState.value.accumulated
  const dismissedIds = [...dialogState.value.dismissedIds]
  const contextStatusFields = continuingContextStatus(
    priorUserUtterances,
    accumulated,
    dismissedIds
  )

  const priorCluePreview =
    priorUserUtterances.length > 0 ? priorUserUtterances[priorUserUtterances.length - 1] : undefined
  recallTelemetry.beginClue({
    clue: trimmed,
    ...(priorUserUtterances.length > 0 && priorCluePreview ? { priorCluePreview } : {})
  })

  try {
    const response = await recallWithClue({
      clue: trimmed,
      source: 'sidepanel',
      recallId,
      progressRequestId,
      ...(priorUserUtterances.length > 0 || accumulated || dismissedIds.length > 0
        ? {
            context: {
              ...(priorUserUtterances.length > 0 ? { priorUserUtterances } : {}),
              ...(accumulated ? { accumulated } : {}),
              ...(dismissedIds.length > 0 ? { dismissedIds } : {})
            }
          }
        : {})
    })
    if (requestId !== recallRequestId) {
      return
    }
    if (response.ok) {
      enqueueMissingVisibleProgressStages(response.result.visibleProgressStages)
    }
    await finishRecallVisibleProgressUi()
    if (requestId !== recallRequestId) {
      return
    }
    isRecallRefreshing.value = false
    if (!response.ok) {
      errorMessage.value = tRecallError(response.errorCode)
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'error',
          text: errorMessage.value,
          ...contextStatusFields
        })
      )
      return
    }

    // 成功且有合并 parsed 时推进会话（噪音拒绝无 parsed，不污染 prior）
    if (response.result.parsed) {
      dialogState.value = {
        priorUserUtterances: [...priorUserUtterances, trimmed].slice(-5),
        accumulated: response.result.parsed,
        dismissedIds
      }
    }

    const highlightClue = response.result.effectiveClue ?? response.result.clue
    const resultIds = collectResultIdsFromRecall(response.result)

    if (response.result.outcome === 'top_pick' || response.result.outcome === 'need_a_clue') {
      outcomeSession.value = {
        ...outcomeSession.value,
        effectiveClue: highlightClue,
        resultIds,
        // 新候选短名单出现后，清掉「待处理 dismiss」，避免后续找着了仍被 sticky none 盖住
        dismissedPending: false,
        sawNoMatchFinal: false
      }
    } else {
      outcomeSession.value = {
        ...outcomeSession.value,
        effectiveClue: highlightClue,
        resultIds,
        sawNoMatchFinal: true,
        dismissedPending: false
      }
      void commitRecallOutcome({
        state: outcomeSession.value,
        reason: 'no_match'
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
          // 忽略
        })
    }

    if (response.result.outcome === 'top_pick') {
      const rankedCards = [
        ...(response.result.topPick
          ? [toMatchCard(response.result.topPick, highlightClue, { rank: 0 })]
          : []),
        ...response.result.alsoPossible.map((match, index) =>
          toMatchCard(match, highlightClue, {
            rank: (response.result.topPick ? 1 : 0) + index
          })
        )
      ]
      const total = response.result.totalRankedCount || rankedCards.length
      const visibleCount = Math.min(RECALL_RESULT_PAGE_SIZE, rankedCards.length)
      const envOrLlmFollowUp = response.result.assistantFollowUp
      const understandingEcho = resolveUnderstandingEchoChips(response.result.parsed)
      const listReply = resolveListReplyText(
        response.result,
        total,
        visibleCount,
        formatRankedReplyText(total, visibleCount),
        { omitUnderstood: Boolean(understandingEcho) }
      )
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'confident',
          text: listReply.text,
          ...contextStatusFields,
          ...(understandingEcho ? { understandingEcho } : {}),
          candidateCards: rankedCards,
          visibleCount,
          rankedTotalCount: total,
          ...(listReply.recallFramingFacts !== undefined
            ? { recallFramingFacts: listReply.recallFramingFacts }
            : {}),
          ...(envOrLlmFollowUp?.suggestions?.length
            ? { suggestions: envOrLlmFollowUp.suggestions }
            : {}),
          ...(response.result.composerNarrowExamples?.length
            ? { composerNarrowExamples: response.result.composerNarrowExamples }
            : {}),
          allowDismiss: rankedCards.length > 0
        })
      )
      // Getting Started Step 2：邻域出现即算「召回到信息」，不必再点开结果
      void markFirstRecallOpenDone().catch(() => {
        // 忽略：引导标记失败不影响结果展示
      })
    } else if (response.result.outcome === 'need_a_clue') {
      const llmFollowUp = response.result.assistantFollowUp
      const candidateCards = response.result.alsoPossible.map((match, index) =>
        toMatchCard(match, highlightClue, { rank: index })
      )
      const total = response.result.totalRankedCount || candidateCards.length
      const visibleCount = Math.min(RECALL_RESULT_PAGE_SIZE, candidateCards.length)
      const understandingEcho = resolveUnderstandingEchoChips(response.result.parsed)
      const listReply = resolveListReplyText(
        response.result,
        total,
        visibleCount,
        formatRankedReplyText(total, visibleCount),
        { omitUnderstood: Boolean(understandingEcho) }
      )
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'uncertain',
          text: listReply.text,
          ...contextStatusFields,
          ...(understandingEcho ? { understandingEcho } : {}),
          candidateCards,
          visibleCount,
          rankedTotalCount: total,
          ...(listReply.recallFramingFacts !== undefined
            ? { recallFramingFacts: listReply.recallFramingFacts }
            : {}),
          ...(llmFollowUp?.suggestions?.length ? { suggestions: llmFollowUp.suggestions } : {}),
          ...(response.result.composerNarrowExamples?.length
            ? { composerNarrowExamples: response.result.composerNarrowExamples }
            : {}),
          allowDismiss: candidateCards.length > 0
        })
      )
    } else {
      const relatedGuess = response.result.relatedGuess ?? null
      const missFallback = resolveMissAssistantText({
        ...(response.result.emptyKind !== undefined
          ? { emptyKind: response.result.emptyKind }
          : {}),
        hasRelatedGuess: relatedGuess !== null,
        library: libraryState.value,
        clue: highlightClue
      })
      const understandingEcho = resolveUnderstandingEchoChips(response.result.parsed)
      const omitUnderstood = Boolean(understandingEcho)
      const missFacts = response.result.recallFraming?.facts
      const missReply =
        missFacts !== undefined
          ? {
              text: renderRecallFraming(missFacts, t, { omitUnderstood }),
              recallFramingFacts: missFacts
            }
          : response.result.recallFraming?.text.trim() && !omitUnderstood
            ? {
                text: response.result.recallFraming.text,
                recallFramingFacts: response.result.recallFraming.facts
              }
            : { text: missFallback }
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'miss',
          text: missReply.text,
          ...contextStatusFields,
          ...(understandingEcho ? { understandingEcho } : {}),
          ...(missReply.recallFramingFacts !== undefined
            ? { recallFramingFacts: missReply.recallFramingFacts }
            : {}),
          ...(relatedGuess
            ? {
                relatedGuessCard: toMatchCard(relatedGuess, highlightClue, { rank: 0 }),
                relatedGuessLabel: t('popup_related_guess_label')
              }
            : {})
        })
      )
    }

    const renderedCount =
      response.result.outcome === 'no_match'
        ? response.result.relatedGuess
          ? 1
          : 0
        : response.result.totalRankedCount
    recallTelemetry.recordResultRendered({
      outcome: response.result.outcome,
      resultCount: renderedCount,
      ...(response.result.pipelineTiming ? { pipelineTiming: response.result.pipelineTiming } : {})
    })

    void probeMemoryLibrary()
    void nextTick(() => {
      clueInputRef.value?.focus()
    })
  } catch {
    if (requestId !== recallRequestId) {
      return
    }
    await finishRecallVisibleProgressUi()
    if (requestId !== recallRequestId) {
      return
    }
    isRecallRefreshing.value = false
    errorMessage.value = t('popup_recall_failed')
    conversationTurns.value.push(
      createAssistantTurn({
        id: nextTurnId(),
        tone: 'error',
        text: errorMessage.value,
        ...contextStatusFields
      })
    )
  }
}

function handleNavigateError(message: string) {
  errorMessage.value = message
}

async function handleSendTurn(
  overrideClue?: string,
  options?: { skipPivotCheck?: boolean }
): Promise<void> {
  const trimmed = (overrideClue ?? clue.value).trim()
  if (!trimmed || isRecallRefreshing.value || showOutcomeExitStrip.value) {
    return
  }

  // 确认条已开：再发送只更新暂存线索，仍等用户点选
  if (showThreadPivotStrip.value && !options?.skipPivotCheck) {
    pendingPivotClue.value = trimmed
    clue.value = ''
    return
  }

  if (!options?.skipPivotCheck && hasActiveFindSession.value) {
    const anchorTerms = collectThreadAnchorTerms({
      contentTerms: dialogState.value.accumulated?.contentTerms ?? [],
      priorUserUtterances: dialogState.value.priorUserUtterances
    })
    if (
      shouldOfferThreadPivotConfirm({
        clue: trimmed,
        anchorTerms,
        lastSubmitAtMs: lastSubmitAtMs.value,
        nowMs: Date.now()
      })
    ) {
      pendingPivotClue.value = trimmed
      showThreadPivotStrip.value = true
      clue.value = ''
      return
    }
  }

  await commitSendTurn(trimmed)
}

/** 真正推入用户气泡并召回（已过软岔路口或芯片跳过）。 */
async function commitSendTurn(trimmedClue: string): Promise<void> {
  const trimmed = trimmedClue.trim()
  if (!trimmed || isRecallRefreshing.value) {
    return
  }

  lastSentClue.value = trimmed
  lastSubmitAtMs.value = Date.now()

  // 发送后强制黏底，保证看见待回复与结果
  stickToBottom.value = true

  conversationTurns.value.push({
    id: nextTurnId(),
    role: 'user',
    text: trimmed
  })

  // 发送后清空输入，避免 no_match 文案仍依赖输入态
  clue.value = ''

  expandedDuplicateGroupId.value = null
  await runRecall(trimmed)
}

/** 软岔路口：继续 refine 当前线程。 */
function handleThreadPivotContinue(): void {
  const pending = pendingPivotClue.value?.trim() ?? ''
  clearThreadPivotStrip()
  if (!pending) {
    return
  }
  void commitSendTurn(pending)
}

/** 软岔路口：开新找后再以暂存线索首轮召回（跳过出口条，避免打断发送）。 */
async function handleThreadPivotNew(): Promise<void> {
  const pending = pendingPivotClue.value?.trim() ?? ''
  clearThreadPivotStrip()
  await completeNewFindSession('thread_pivot_new')
  if (!pending) {
    return
  }
  await commitSendTurn(pending)
}

/** 追问芯片：点击即发送一轮（稳定英文 value / 当前 locale label）；跳过软岔路口。 */
function handleUseSuggestion(value: string): void {
  if (!value.trim() || isRecallRefreshing.value) {
    return
  }
  void handleSendTurn(value, { skipPivotCheck: true })
}

/** Idle 口语范式：仅填入 composer，可改再发（推荐不强制）。 */
function handleIdleParadigmFill(value: string): void {
  const trimmed = value.trim()
  if (!trimmed || isRecallRefreshing.value) {
    return
  }
  clue.value = trimmed
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
}

/**
 * 关 Side Panel：静默结算 Outcome（不跨次打开补问出口条）。
 * Chrome 无法拦截原生关闭；跨次问「上次找没找到」无上下文、易错愕。
 */
async function handlePanelCloseOutcome(): Promise<void> {
  if (outcomeCloseHandled) {
    return
  }
  outcomeCloseHandled = true
  finalizeOpenDwell()
  await flushOutcomeSession('panel_close', true)
}

/** 取消登录态 storage 订阅。 */
let stopWatchAuthSession: (() => void) | null = null

function handleRecallVisibleProgressPush(message: unknown): void {
  const parsed = parseRecallVisibleProgressMessage(message)
  if (!parsed) {
    return
  }
  if (parsed.payload.progressRequestId !== recallProgressRequestId.value) {
    return
  }
  enqueueRecallVisibleProgressStage(parsed.payload.stage)
}

onMounted(() => {
  chrome.runtime.onMessage.addListener(handleRecallVisibleProgressPush)
  chrome.storage.onChanged.addListener(handleRecallPrefillStorageChanged)
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
  void loadOnboardingState()
  void loadGreetingIdentity()
  stopWatchAuthSession = watchAuthSessionStorage(() => {
    void loadGreetingIdentity()
  })
  void (async () => {
    try {
      // Getting Started / Omnibox 接力：写 prefill 与开壳可能竞态，短窗重试
      const prefill = await consumeRecallPrefillWithRetry()
      if (!prefill) {
        return
      }
      applyRecallPrefillClue(prefill)
    } catch {
      // 忽略：无预填不阻塞 Side Panel
    }
  })()
  void probeMemoryLibrary()
  startImportPolling()
  startColdStartPolling()
  void (async () => {
    try {
      coldStartPostReleaseDismissedReadyAt.value =
        await readColdStartPostReleaseBannerDismissedReadyAt()
      scheduleColdStartPostReleaseBannerExpiry()
    } catch {
      // 忽略：无 dismiss 记录不阻塞
    }
  })()
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleRecallVisibleProgressPush)
  chrome.storage.onChanged.removeListener(handleRecallPrefillStorageChanged)
  clearRecallVisibleProgressUi()
  clearColdStartPostReleaseBannerExpiry()
  void handlePanelCloseOutcome()
  recallTelemetry.clearActiveTask()
  recallRequestId += 1
  stopImportPolling()
  stopColdStartPolling()
  stopWatchAuthSession?.()
  stopWatchAuthSession = null
})
</script>

<template>
  <AppToastHost />
  <main class="recall-shell">
    <ColdStartGate v-if="showColdStartGate && coldStartGateState" :state="coldStartGateState" />

    <header class="recall-header">
      <AppPageHeader
        class="recall-header-top"
        show-new-find
        :new-find-enabled="hasActiveFindSession"
        @navigate-error="handleNavigateError"
        @new-find="startNewFindSession"
      />

      <section
        v-if="showColdStartPostReleaseBanner"
        class="recall-post-release"
        role="status"
        aria-live="polite"
      >
        <div class="recall-post-release-main">
          <p class="recall-post-release-label">{{ coldStartPostReleaseBannerLabel }}</p>
          <AppLinearProgress
            v-if="showColdStartEnrichmentProgressBar"
            class="recall-post-release-bar"
            :value="coldStartEnrichmentProgressRatio"
            :aria-label="t('cold_start_post_release_progress_aria')"
          />
        </div>
        <AppButton
          type="button"
          variant="text"
          class="recall-post-release-dismiss"
          :title="t('cold_start_post_release_dismiss')"
          :aria-label="t('cold_start_post_release_dismiss_aria')"
          @click="dismissColdStartPostReleaseBanner"
        >
          {{ t('cold_start_post_release_dismiss') }}
        </AppButton>
      </section>
    </header>

    <div
      ref="recallBodyRef"
      class="recall-body"
      :class="{ 'recall-body--empty': conversationTurns.length === 0 }"
      @scroll="recallShellScrollListener"
    >
      <section v-if="conversationTurns.length === 0" class="recall-empty" aria-live="polite">
        <div class="recall-greeting-slot">
          <p class="recall-greeting">{{ idleGreeting }}</p>
        </div>
        <div class="recall-empty-main">
          <p class="recall-empty-title">
            {{ idleEmptyCopy?.title ?? t('popup_welcome_title') }}
          </p>
          <p class="recall-empty-copy">
            {{ idleEmptyCopy?.body ?? t('popup_welcome_body') }}
          </p>
          <div
            v-if="showIdleClueParadigms"
            class="recall-idle-paradigms"
            role="group"
            :aria-label="t('popup_idle_paradigm_hint')"
          >
            <p class="recall-idle-paradigms__hint">{{ t('popup_idle_paradigm_hint') }}</p>
            <div class="recall-idle-paradigms__pills">
              <button
                v-for="paradigm in idleClueParadigmButtons"
                :key="paradigm.id"
                type="button"
                class="recall-idle-paradigm-pill"
                :title="paradigm.clue"
                :aria-label="paradigm.ariaLabel"
                @click="handleIdleParadigmFill(paradigm.clue)"
              >
                {{ paradigm.clue }}
              </button>
            </div>
          </div>
          <div v-if="captureFirstMode" class="recall-empty-actions">
            <AppButton type="button" @click="handleOpenGettingStarted" variant="tonal">
              {{ t('popup_open_getting_started') }}
            </AppButton>
            <AppButton
              type="button"
              :disabled="skipOnboardingBusy"
              @click="handleSkipOnboarding"
              variant="text"
            >
              {{ t('popup_skip_onboarding') }}
            </AppButton>
          </div>
        </div>
      </section>

      <RecallConversation
        v-else
        :turns="conversationTurns"
        :expandedDuplicateGroupId="expandedDuplicateGroupId"
        :expandLabel="t('popup_duplicate_expand')"
        :collapseLabel="t('popup_duplicate_collapse')"
        :noteFieldLabel="t('detail_note_label')"
        :pending="isRecallRefreshing"
        :pendingLabel="recallPendingLabel"
        :pendingSteps="recallPendingSteps"
        :selected-detail-export-ids="selectedDetailExportIds"
        :detail-export-selection-active="detailExportMode"
        @open="handleCardOpen"
        @evidence-visible="handleEvidenceVisible"
        @toggle-detail-export-selection="handleToggleDetailExportSelection"
        @toggle-expand="toggleDuplicateGroup"
        @dismiss="handleDismissCandidates"
        @show-more="handleShowMoreMatches"
        @use-suggestion="handleUseSuggestion"
      />
    </div>

    <div
      v-if="
        hasRecallResultCards && !detailExportMode && !showOutcomeExitStrip && !showThreadPivotStrip
      "
      class="recall-detail-export-entry"
    >
      <AppButton type="button" variant="text" @click="enterDetailExportMode">
        {{ t('detail_export_start') }}
      </AppButton>
    </div>

    <div
      v-if="showOutcomeExitStrip"
      class="recall-outcome-exit"
      role="group"
      :aria-label="t('popup_outcome_exit_prompt')"
    >
      <p class="recall-outcome-exit__prompt">
        {{ t('popup_outcome_exit_prompt') }}
      </p>
      <div class="recall-outcome-exit__actions">
        <AppButton type="button" variant="filled" @click="handleOutcomeExitFound">
          {{ t('popup_outcome_exit_found') }}
        </AppButton>
        <AppButton type="button" variant="outlined" @click="handleOutcomeExitNone">
          {{ t('popup_outcome_exit_none') }}
        </AppButton>
        <AppButton type="button" variant="text" @click="handleOutcomeExitSkip">
          {{ t('popup_outcome_exit_skip') }}
        </AppButton>
      </div>
    </div>

    <div
      v-if="showThreadPivotStrip && threadFindTitle"
      class="recall-thread-pivot"
      role="group"
      :aria-label="t('popup_thread_pivot_prompt', threadFindTitle)"
    >
      <p class="recall-thread-pivot__prompt">
        {{ t('popup_thread_pivot_prompt', threadFindTitle) }}
      </p>
      <div class="recall-thread-pivot__actions">
        <AppButton type="button" variant="filled" @click="handleThreadPivotContinue">
          {{ t('popup_thread_pivot_continue') }}
        </AppButton>
        <AppButton type="button" variant="outlined" @click="handleThreadPivotNew">
          {{ t('popup_thread_pivot_new') }}
        </AppButton>
      </div>
    </div>

    <DetailExportBarDock :visible="showDetailExportBar">
      <DetailExportBar
        class="recall-detail-export-bar"
        :selected-count="detailExportSelectedCount"
        :exporting="detailExportExporting"
        @copy-json="runDetailExportAction('json', 'copy')"
        @copy-markdown="runDetailExportAction('markdown', 'copy')"
        @download-json="runDetailExportAction('json', 'download')"
        @download-markdown="runDetailExportAction('markdown', 'download')"
        @clear="clearDetailExportSelection"
      />
    </DetailExportBarDock>

    <RecallComposer
      ref="clueInputRef"
      v-model="clue"
      :ariaLabel="t('popup_clue_input_aria')"
      :placeholder="composerPlaceholder"
      :sendLabel="t('popup_submit')"
      :disabled="isRecallRefreshing || showOutcomeExitStrip"
      :prominent="isComposerProminent"
      :thread-title="threadFindTitle"
      :thread-title-label="t('popup_thread_title_label')"
      :thread-title-aria="threadTitleAria"
      :thread-new-find-label="t('popup_thread_anchor_clear')"
      @send="handleSendTurn"
      @clear-thread="startNewFindSession"
    />
  </main>
</template>

<style scoped>
/*
 * Side Panel：随侧栏宽度伸缩；竖向占满可视高度以承载持续对话。
 * 勿再锁 360px（那是旧 Action Popup 约束）。
 */
:global(html),
:global(body) {
  width: 100%;
  max-width: 100%;
  height: 100%;
  margin: 0;
  overflow-x: hidden;
}

:global(#app) {
  height: 100%;
}

.recall-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  min-height: 100%;
  max-height: none;
  /* 顶栏非对称内边距：略紧于标准 page shell */
  padding: var(--space-sm) var(--space-md) var(--space-md);
  color: var(--on-surface);
  background: var(--surface);
  overflow: hidden;
}

.recall-detail-export-entry {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  margin-top: calc(-1 * var(--space-2xs));
  margin-bottom: var(--space-xs);
  padding: 0 var(--space-2xs);
}

.recall-detail-export-bar {
  flex-shrink: 0;
  margin-top: var(--space-xs);
  margin-bottom: var(--space-xs);
  overflow: visible;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.recall-outcome-exit {
  display: grid;
  gap: var(--space-xs);
  flex-shrink: 0;
  margin-top: var(--space-xs);
  margin-bottom: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-chrome);
}

.recall-thread-pivot {
  display: grid;
  gap: var(--space-xs);
  flex-shrink: 0;
  margin-top: var(--space-xs);
  margin-bottom: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
}

.recall-thread-pivot__prompt {
  margin: 0;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface);
  overflow-wrap: anywhere;
}

.recall-thread-pivot__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.recall-outcome-exit__prompt {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface);
}

.recall-outcome-exit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.recall-header {
  flex-shrink: 0;
  min-width: 0;
  margin-bottom: var(--space-sm);
}

.recall-header-top {
  margin-bottom: 2px;
}

.recall-header-top:deep(.app-page-header__logo) {
  width: 24px;
  height: 24px;
}

.recall-header-top:deep(.app-page-header__brand) {
  font-size: 17px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: -0.01em;
  color: var(--on-surface);
}

.recall-header-top:deep(.app-page-header__nav) {
  gap: 2px;
}

.recall-header-top:deep(.app-icon-button) {
  color: var(--on-surface-muted);
}

.recall-post-release {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  justify-content: space-between;
  margin-top: var(--space-xs);
  margin-bottom: 0;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-white);
}

.recall-post-release-main {
  display: grid;
  flex: 1 1 auto;
  gap: var(--space-2xs);
  min-width: 0;
}

.recall-post-release-label {
  margin: 0;
  min-width: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.recall-post-release-bar {
  max-width: 100%;
}

.recall-post-release-dismiss {
  flex: 0 0 auto;
  margin: -2px 0 0;
}

.recall-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.recall-body--empty {
  padding-bottom: var(--space-xs);
}

.recall-empty {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: var(--space-md);
  width: 100%;
  min-height: 0;
  padding: var(--space-2xs) var(--space-2xs) var(--space-md);
  text-align: left;
  background: transparent;
}

/* 占满中间空白，问候垂直居中，成为空态主视觉 */
.recall-greeting-slot {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-height: 120px;
  padding: var(--space-xs) 0;
}

.recall-greeting {
  margin: 0;
  max-width: 18ch;
  font-size: clamp(28px, 7vw, 36px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--on-surface);
  text-wrap: balance;
  animation: recall-greeting-in var(--motion-duration-medium) var(--motion-easing-emphasized) both;
}

.recall-empty-main {
  display: grid;
  justify-items: start;
  flex-shrink: 0;
  gap: var(--space-xs);
  width: 100%;
  max-width: 44ch;
}

.recall-empty-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.recall-empty-copy {
  max-width: 32ch;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
  text-wrap: pretty;
}

.recall-idle-paradigms {
  display: grid;
  gap: var(--space-2xs);
  width: 100%;
  max-width: 100%;
  margin-top: var(--space-2xs);
}

.recall-idle-paradigms__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.recall-idle-paradigms__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.recall-idle-paradigm-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 32px;
  padding: 0 var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font: inherit;
  font-size: 13px;
  line-height: 1.3;
  color: var(--on-surface);
  background: var(--surface-white);
  cursor: pointer;
  text-align: left;
  text-wrap: pretty;
}

.recall-idle-paradigm-pill:hover {
  background: var(--surface-chrome);
}

.recall-idle-paradigm-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs) var(--space-xs);
  justify-content: flex-start;
  margin-top: var(--space-2xs);
}

@keyframes recall-greeting-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recall-greeting {
    animation: none;
  }
}

.recall-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
  max-width: 100%;
  min-height: 0;
}

.recall-need-clue {
  display: grid;
  gap: var(--space-2xs);
}

.recall-need-clue-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--on-surface);
}

.recall-need-clue-copy {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.recall-section-label {
  margin: 0 0 var(--space-xs);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--on-surface-muted);
}

.recall-feedback-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.recall-top-pick {
  display: grid;
  flex-shrink: 0;
  gap: var(--space-xs);
  min-width: 0;
}

/* Also 区块：标题固定，仅列表滚动 */
.recall-also {
  display: flex;
  flex-direction: column;
  flex: 0 1 auto;
  min-width: 0;
  min-height: 0;
}

.recall-also > .recall-section-label {
  flex-shrink: 0;
}

.recall-also-list {
  display: grid;
  flex: 0 1 auto;
  gap: var(--space-xs);
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0 0 var(--space-2xs);
  overflow: hidden auto;
  overscroll-behavior: contain;
  list-style: none;
}

.recall-also-list > li {
  min-width: 0;
  max-width: 100%;
}
</style>
