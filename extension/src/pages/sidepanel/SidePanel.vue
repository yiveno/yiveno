<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'

import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'
import { watchWebsiteAuthUiStorage } from '@/infrastructure/auth/watch-website-auth-ui-storage'
import { readWebsiteAuthUiState } from '@/infrastructure/auth/website-auth-ui-storage'
import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { computeComposerPlaceholder } from '@/core/recall/compute-composer-placeholder'
import { extractComposerNarrowExamples } from '@/core/recall/extract-composer-narrow-examples'
import { resolveThreadFindTitle } from '@/core/recall/resolve-thread-anchor-label'
import { formatCluePlainForUserDisplay } from '@/core/recall/clue-plain-url'
import {
  collectThreadAnchorTerms,
  shouldOfferThreadPivotConfirm
} from '@/core/recall/should-offer-thread-pivot-confirm'
import { renderRecallFraming } from '@/core/recall/render-recall-framing'
import { parseRecallVisibleProgressMessage } from '@/core/messaging/ui-messages'
import { tRecallError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import { commitRecallOutcome } from '@/application/recall/commit-recall-outcome'
import {
  authConnectWebsite,
  cancelRecall,
  fetchAuthState,
  getRecallPageContext,
  probeWebsiteSignedIn,
  recallWithClue
} from '@/infrastructure/messaging/background-client'
import {
  clearExtensionDisplacedNotice,
  readExtensionDisplacedNotice
} from '@/infrastructure/storage/extension-displaced-notice-storage'
import {
  consumeRecallPrefillWithRetry,
  markFirstRecallOpenDone
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import { readBrowserOnline, subscribeBrowserOnline } from '@/infrastructure/browser/browser-online'
import { subscribeActiveTabNavigation } from '@/infrastructure/browser/subscribe-active-tab-navigation'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import DetailExportBar from '@/infrastructure/ui/DetailExportBar.vue'
import DetailExportBarDock from '@/infrastructure/ui/DetailExportBarDock.vue'
import AppToastHost from '@/infrastructure/ui/AppToastHost.vue'
import LoginMigrationDialog from '@/pages/shared/LoginMigrationDialog.vue'
import { useLoginMigrationDialog } from '@/pages/shared/use-login-migration-dialog'
import RecallConversation from '@/pages/sidepanel/components/RecallConversation.vue'
import RecallComposer from '@/pages/sidepanel/components/RecallComposer.vue'
import RecallPageContextControls from '@/pages/sidepanel/components/RecallPageContextControls.vue'
import ColdStartGate from '@/pages/sidepanel/components/ColdStartGate.vue'
import { resolvePageContextMode } from '@/core/recall/page-context-mode'
import type { RecallSourceScope } from '@/core/recall/recall-source-scope'
import { createAssistantTurn } from '@/pages/sidepanel/build-assistant-turn'
import type { ConversationTurn, AssistantTurn } from '@/pages/sidepanel/recall-conversation-types'
import { useRecallShellScroll } from '@/pages/sidepanel/use-recall-shell-scroll'
import type { RecallDialogState } from '@/core/recall/merge-recall-dialog-turn'
import { shouldOfferRecallOutcomeExitPrompt } from '@/application/recall/commit-recall-outcome'
import { createRecallTelemetryRecorder } from '@/infrastructure/analytics/recall-telemetry-recorder'
import { useRecallVisibleProgress } from '@/pages/sidepanel/use-recall-visible-progress'
import { useSidepanelColdStart } from '@/pages/sidepanel/use-sidepanel-cold-start'
import { useRecallOutcomeSession } from '@/pages/sidepanel/use-recall-outcome-session'
import { useDetailExport } from '@/pages/sidepanel/use-detail-export'
import { useRecallResultCards } from '@/pages/sidepanel/use-recall-result-cards'
import {
  formatRankedReplyText,
  resolveUnderstandingEchoChips,
  resolveListReplyText,
  toMatchCard
} from '@/pages/sidepanel/recall-result-card-helpers'

defineOptions({ name: 'SidePanelPage' })

const {
  dismissDeleteAfterExport,
  dismissLoginMigration,
  loginMigrationBookmarkCount,
  loginMigrationDeleteAfterExportOpen,
  loginMigrationError,
  loginMigrationExcerptCount,
  loginMigrationLoading,
  loginMigrationOpen,
  refreshLoginMigrationGate,
  runLoginMigrationDelete,
  runLoginMigrationExport,
  runLoginMigrationImport
} = useLoginMigrationDialog()

const clue = ref('')
const clueInputRef = ref<InstanceType<typeof RecallComposer> | null>(null)
/** 有旧结果时后台刷新，避免拆掉列表 DOM。 */
const isRecallRefreshing = ref(false)
const errorMessage = ref('')

/** §5.9 TTE 七事件 + §7.0 wait_abandoned 本机录制（与 Outcome 会话同寿）。 */
const recallTelemetry = createRecallTelemetryRecorder()

const {
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
} = useRecallVisibleProgress({
  isRecallRefreshing,
  recordWaitAbandoned: input => {
    recallTelemetry.recordWaitAbandoned(input)
  }
})

/** 官网已登录 → 是否同步连到本扩展（仅此用途；与被挤掉说明分开） */
const showWebsiteConnectBanner = ref(false)
const websiteConnectBusy = ref(false)
/** Connect 失败/超时短提示（成功则条消失）。 */
const websiteConnectError = ref('')
/** 被别处挤掉后的原因说明（无 Connect；Dismiss 只清 displaced 标记） */
const showExtensionDisplacedBanner = ref(false)
/** 壳级断网薄适配（ADR-021）：本机库可读、云端理解不可用（不可 dismiss；恢复在线自动隐） */
const isBrowserOnline = ref(readBrowserOnline())
const showOfflineBanner = computed(() => !isBrowserOnline.value)
const lastSentClue = ref('')
/** 登录展示名；未登录或无名则空，问候退化为仅时段。 */
const accountDisplayName = ref('')

/** handleSendTurn 定义前占位；定义后改写，供预填自动提交。 */
let autoSubmitPrefillClue: (clueText: string) => void = () => {}

const {
  libraryState,
  skipOnboardingBusy,
  showColdStartGate,
  coldStartGateState,
  showColdStartPostReleaseBanner,
  coldStartEnrichmentProgressRatio,
  coldStartPostReleaseBannerLabel,
  showColdStartEnrichmentProgressBar,
  bookmarkFuel,
  captureFirstMode,
  idleEmptyCopy,
  showEmptyImportCta,
  showEmptySetupCta,
  idleGreeting,
  applyRecallPrefillClue,
  handleRecallPrefillStorageChanged,
  handleLibraryMembershipStorageChanged,
  loadOnboardingState,
  handleSkipOnboarding,
  handleOpenGettingStarted,
  handleOpenBookmarkIngestSettings,
  probeMemoryLibrary,
  refreshBookmarkIngestSetting,
  startImportPolling,
  stopImportPolling,
  startColdStartPolling,
  stopColdStartPolling,
  clearColdStartPostReleaseBannerExpiry,
  dismissColdStartPostReleaseBanner,
  hydrateColdStartPostReleaseDismissed
} = useSidepanelColdStart({
  clue,
  clueInputRef,
  accountDisplayName,
  onAutoSubmitPrefill: clueText => {
    autoSubmitPrefillClue(clueText)
  }
})

/** Side Panel 会话：槽位 accumulated + 本会话否定 id（关闭 Panel 即丢，P0）。 */
const dialogState = ref<RecallDialogState>({
  priorUserUtterances: [],
  accumulated: null,
  dismissedIds: []
})

/** handleCompleteNewFindSession 定义前占位；定义后改写，供出口条回调。 */
let completeNewFindSessionFn: (reason: string) => void | Promise<void> = () => {}

const {
  outcomeSession,
  showOutcomeExitStrip,
  pendingPrefillAfterExit,
  markOutcomeCloseHandled,
  handleOutcomeExitFound,
  handleOutcomeExitNone,
  handleOutcomeExitSkip,
  finalizeOpenDwell,
  flushOutcomeSession,
  collectResultIdsFromRecall,
  resolveMissAssistantCopy,
  resetOutcomeSession
} = useRecallOutcomeSession({
  bookmarkFuel,
  recallTelemetry,
  onCompleteNewFindSession: reason => completeNewFindSessionFn(reason)
})

/** 软岔路口：发送前确认 Keep refining / Start new。 */
const showThreadPivotStrip = ref(false)
/** 待确认的线索（确认条出示期间暂存）。 */
const pendingPivotClue = ref<string | null>(null)
/** 上次成功提交线索的时间（冷却启发式）。 */
const lastSubmitAtMs = ref<number | null>(null)

/** §7.1 composer 页上下文（会话级；默认收起、双关 = none）。 */
const pageContextDomain = ref<string | null>(null)
const pageContextExpanded = ref(false)
const pageContextCombine = ref(false)
const pageContextOnlySite = ref(false)
/** 来源范围：默认全部；New find 复位。 */
const recallSourceScope = ref<RecallSourceScope>('all')

const conversationTurns = ref<ConversationTurn[]>([])
let turnSeq = 0

const {
  selectedDetailExportIds,
  detailExportMode,
  detailExportExporting,
  detailExportSelectedCount,
  showDetailExportBar,
  hasRecallResultCards,
  enterDetailExportMode,
  handleToggleDetailExportSelection,
  clearDetailExportSelection,
  runDetailExportAction
} = useDetailExport({
  conversationTurns,
  outcomeSession
})

const recallBodyRef = ref<HTMLElement | null>(null)
/** 浮底 composer 栈（含出口条 / 导出条）；量高给会话区底 padding，内容可滚到半透明壳下。 */
const recallFloatDockRef = ref<HTMLElement | null>(null)
const recallScrollRegionRef = ref<HTMLElement | null>(null)

const {
  stickToBottom,
  scrollJumpDirection,
  scrollJumpLabel,
  recallShellScrollListener,
  handleScrollJump
} = useRecallShellScroll({
  recallBodyRef,
  recallFloatDockRef,
  recallScrollRegionRef,
  conversationTurns,
  isRecallRefreshing
})

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

/**
 * 本场找会话标题字面（完整 URL 等）— 供 a11y / 与 prior utterances 对齐的权威字面。
 * 用户可见展示另走 threadFindTitleDisplay（URL 缩短）。
 */
const threadFindTitle = computed(() =>
  resolveThreadFindTitle({
    priorUserUtterances: dialogState.value.priorUserUtterances,
    contentTerms: dialogState.value.accumulated?.contentTerms ?? []
  })
)

/** 用户可见：标题里的 URL → 缩短 host/path；不改会话存储与召回传输。 */
const threadFindTitleDisplay = computed(() => {
  const title = threadFindTitle.value
  return title ? formatCluePlainForUserDisplay(title) : null
})

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
  // 断网薄适配空闲：本机模式 placeholder（ADR-021；非换肤、非离线产品）
  if (showOfflineBanner.value && isIdle) {
    return t('sidepanel_offline_composer_placeholder')
  }

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
    ...(threadFindTitleDisplay.value ? { threadLabel: threadFindTitleDisplay.value } : {})
  })

  if (result.messageArgs.length === 0) {
    return t(result.messageKey)
  }
  return t(result.messageKey, result.messageArgs)
})

function nextTurnId(): string {
  turnSeq += 1
  return String(turnSeq)
}

const {
  expandedDuplicateGroupId,
  handleShowMoreMatches,
  toggleDuplicateGroup,
  handleCardOpen,
  handleEvidenceVisible,
  handleDismissCandidates
} = useRecallResultCards({
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
})

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
  const display = label ? formatCluePlainForUserDisplay(label) : null
  return {
    contextStatus: display
      ? t('popup_session_status_continuing_threaded', display)
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
  recordVisibleProgressWaitAbandoned('new_find')
  await flushOutcomeSession(reason, true)
  recallRequestId += 1
  isRecallRefreshing.value = false
  clearRecallVisibleProgressUi()
  dialogState.value = {
    priorUserUtterances: [],
    accumulated: null,
    dismissedIds: []
  }
  resetOutcomeSession()
  recallTelemetry.clearActiveTask()
  conversationTurns.value = []
  clue.value = ''
  lastSentClue.value = ''
  lastSubmitAtMs.value = null
  errorMessage.value = ''
  expandedDuplicateGroupId.value = null
  clearDetailExportSelection()
  stickToBottom.value = true
  pageContextExpanded.value = false
  pageContextCombine.value = false
  pageContextOnlySite.value = false
  recallSourceScope.value = 'all'
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

completeNewFindSessionFn = (reason: string) => completeNewFindSession(reason)

/** 刷新当前浏览页域名（展示用；用户开关不因短暂无 http 页被清掉）。 */
async function refreshPageContextDomain(): Promise<void> {
  try {
    const response = await getRecallPageContext()
    pageContextDomain.value = response.ok ? response.domain : null
  } catch {
    pageContextDomain.value = null
  }
}

function handlePageContextExpanded(next: boolean): void {
  pageContextExpanded.value = next
  if (next) {
    void refreshPageContextDomain()
  }
}

/** 页上下文展示或已开启时，跟活动标签走，避免入口写死过期 host。 */
const needsLivePageContextDomain = computed(
  () => pageContextExpanded.value || pageContextCombine.value || pageContextOnlySite.value
)

/** 取消活动标签导航订阅（页面上下文域名刷新）。 */
let stopPageContextTabNavigation: (() => void) | null = null
let pageContextDomainRefreshTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRefreshPageContextDomain(): void {
  if (pageContextDomainRefreshTimer !== null) {
    clearTimeout(pageContextDomainRefreshTimer)
  }
  pageContextDomainRefreshTimer = setTimeout(() => {
    pageContextDomainRefreshTimer = null
    void refreshPageContextDomain()
  }, 120)
}

function attachPageContextTabListeners(): void {
  if (stopPageContextTabNavigation) {
    return
  }
  stopPageContextTabNavigation = subscribeActiveTabNavigation(() => {
    scheduleRefreshPageContextDomain()
  })
}

function detachPageContextTabListeners(): void {
  stopPageContextTabNavigation?.()
  stopPageContextTabNavigation = null
  if (pageContextDomainRefreshTimer !== null) {
    clearTimeout(pageContextDomainRefreshTimer)
    pageContextDomainRefreshTimer = null
  }
}

watch(
  needsLivePageContextDomain,
  needed => {
    if (needed) {
      attachPageContextTabListeners()
      void refreshPageContextDomain()
      return
    }
    detachPageContextTabListeners()
  },
  { immediate: true }
)

/** 递增以丢弃过期找回响应，避免慢请求覆盖新线索结果。 */
let recallRequestId = 0

/** Side Panel 共用的 storage.onChanged：session 预填 + local 库成员信号。 */
function handleSidePanelStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  handleRecallPrefillStorageChanged(changes, areaName)
  handleLibraryMembershipStorageChanged(changes, areaName)
}

/** 读取展示名供空态问候；无展示名时用邮箱本地段。失败不阻塞主路径。 */
async function loadGreetingIdentity(): Promise<void> {
  try {
    const response = await fetchAuthState()
    if (!response.ok) {
      accountDisplayName.value = ''
      void refreshWebsiteConnectBanner(false)
      return
    }
    void refreshWebsiteConnectBanner(response.signedIn)
    if (response.signedIn) {
      void refreshLoginMigrationGate()
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

/**
 * 扩展未登录时的两条独立软条（互不混用文案 / CTA）：
 * - displaced：说明为何本机扩展登录失效（被别处挤掉）
 * - website connect：官网已登录时询问是否 Connect 到本扩展
 */
async function refreshWebsiteConnectBanner(extensionSignedIn: boolean): Promise<void> {
  if (extensionSignedIn) {
    showWebsiteConnectBanner.value = false
    showExtensionDisplacedBanner.value = false
    try {
      await clearExtensionDisplacedNotice()
    } catch {
      // 忽略
    }
    return
  }
  try {
    showExtensionDisplacedBanner.value = await readExtensionDisplacedNotice()
  } catch {
    showExtensionDisplacedBanner.value = false
  }
  // 优先 UI 桥 session 态；无桥行再 probe（打开 Panel 兜底）
  try {
    const ui = await readWebsiteAuthUiState()
    if (ui) {
      showWebsiteConnectBanner.value = ui.signedIn
      return
    }
    const probe = await probeWebsiteSignedIn()
    showWebsiteConnectBanner.value = probe.ok && probe.websiteSignedIn
  } catch {
    showWebsiteConnectBanner.value = false
  }
}

async function connectWebsiteSessionFromBanner(): Promise<void> {
  if (websiteConnectBusy.value) {
    return
  }
  websiteConnectBusy.value = true
  websiteConnectError.value = ''
  try {
    // 软条出现 = 官网已登录 → Connect 专用路径（桥零导航 / 账户页），禁止砸 /login
    const response = await authConnectWebsite()
    if (response.ok) {
      showWebsiteConnectBanner.value = false
      await loadGreetingIdentity()
      return
    }
    if (response.cancelled) {
      // 用户取消挤掉：恢复 Connect，不报错
      return
    }
    websiteConnectError.value = t('sidepanel_website_connect_failed')
  } catch {
    websiteConnectError.value = t('sidepanel_website_connect_failed')
  } finally {
    websiteConnectBusy.value = false
  }
}

/** 仅隐藏当前软条；下次打开 Panel / 刷新探测仍可再出现。 */
function closeWebsiteConnectBanner(): void {
  showWebsiteConnectBanner.value = false
  websiteConnectError.value = ''
}

async function dismissExtensionDisplacedBanner(): Promise<void> {
  showExtensionDisplacedBanner.value = false
  try {
    await clearExtensionDisplacedNotice()
  } catch {
    // 忽略：本地已隐藏
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
  /** 改发前先拍上一轮等待快照（startRecallVisibleProgressUi 会清进度态）。 */
  const supersedeWaitProgress =
    recallProgressStartedAt.value > 0 ? snapshotWaitProgress() : undefined
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
    ...(priorUserUtterances.length > 0 && priorCluePreview ? { priorCluePreview } : {}),
    ...(supersedeWaitProgress ? { supersedeWaitProgress } : {})
  })

  const pageContextMode = resolvePageContextMode({
    combineWithPage: pageContextCombine.value,
    onlyThisSite: pageContextOnlySite.value
  })
  if (pageContextMode !== 'none') {
    // 发送瞬间再读当前 Tab，避免开关展示的 host 已过期
    await refreshPageContextDomain()
  }
  const hasDialogContext = priorUserUtterances.length > 0 || accumulated || dismissedIds.length > 0
  const hasPageContext = pageContextMode !== 'none'
  const hasSourceScope = recallSourceScope.value !== 'all'
  try {
    const response = await recallWithClue({
      clue: trimmed,
      source: 'sidepanel',
      recallId,
      progressRequestId,
      ...(hasDialogContext || hasPageContext || hasSourceScope
        ? {
            context: {
              ...(priorUserUtterances.length > 0 ? { priorUserUtterances } : {}),
              ...(accumulated ? { accumulated } : {}),
              ...(dismissedIds.length > 0 ? { dismissedIds } : {}),
              ...(hasPageContext
                ? {
                    pageContextMode,
                    ...(pageContextDomain.value
                      ? { currentTabDomain: pageContextDomain.value }
                      : {})
                  }
                : {}),
              ...(hasSourceScope ? { sourceScope: recallSourceScope.value } : {})
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
    /** finish 会清进度态；出结果前先拍快照供体验度量。 */
    const completedWaitProgress = snapshotWaitProgress()
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
    /** rules_fallback 结果轻提示；断网 omit LLM（source=rules）不叠 */
    const deeperReadingTipFields =
      response.result.understandSource === 'rules_fallback'
        ? { deeperReadingTip: t('sidepanel_recall_deeper_reading_unavailable') }
        : {}
    /** 超长线索截断轻提示；与 deeperReadingTip 可叠加 */
    const clueTruncatedTipFields =
      response.result.clueTruncated === true
        ? { clueTruncatedTip: t('sidepanel_recall_clue_truncated') }
        : {}

    if (response.result.outcome === 'top_pick' || response.result.outcome === 'need_a_clue') {
      outcomeSession.value = {
        ...outcomeSession.value,
        effectiveClue: highlightClue,
        resultIds,
        // 新候选短名单出现后，清掉「待处理 dismiss」，避免后续找着了仍被 sticky none 盖住
        dismissedPending: false,
        sawNoMatchFinal: false
      }
    } else if (response.result.emptyKind === 'chitchat') {
      // 闲聊短路：不是一次没找到的 recall，不计入 no_match 结算
      outcomeSession.value = {
        ...outcomeSession.value,
        effectiveClue: highlightClue,
        resultIds,
        dismissedPending: false
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
        { omitUnderstood: Boolean(understandingEcho), omitCounts: rankedCards.length > 0 }
      )
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'confident',
          text: listReply.text,
          ...contextStatusFields,
          ...deeperReadingTipFields,
          ...clueTruncatedTipFields,
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
        { omitUnderstood: Boolean(understandingEcho), omitCounts: candidateCards.length > 0 }
      )
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'uncertain',
          text: listReply.text,
          ...contextStatusFields,
          ...deeperReadingTipFields,
          ...clueTruncatedTipFields,
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
      const usedRulesFallback = response.result.understandSource === 'rules_fallback'
      const missFallback = resolveMissAssistantCopy({
        ...(response.result.emptyKind !== undefined
          ? { emptyKind: response.result.emptyKind }
          : {}),
        hasRelatedGuess: relatedGuess !== null,
        library: libraryState.value,
        clue: highlightClue,
        usedRulesFallback,
        ...(response.result.assistantReply !== undefined
          ? { assistantReply: response.result.assistantReply }
          : {})
      })
      const understandingEcho = resolveUnderstandingEchoChips(response.result.parsed)
      const omitUnderstood = Boolean(understandingEcho)
      const missFacts = response.result.recallFraming?.facts
      // 空库燃料文案含「导入」深链时优先，避免 Framing 盖掉可点链接
      const emptyFuelSegments = missFallback.textSegments
      const preferEmptyFuelCopy = Boolean(emptyFuelSegments)
      // rules_fallback 空结果：优先用「简化理解后仍无邻域」正文，避免 Framing/默认 miss 盖掉诚实归因
      const missReply = preferEmptyFuelCopy
        ? missFallback
        : usedRulesFallback
          ? missFallback
          : missFacts !== undefined
            ? {
                text: renderRecallFraming(missFacts, t, { omitUnderstood }),
                recallFramingFacts: missFacts
              }
            : response.result.recallFraming?.text.trim() && !omitUnderstood
              ? {
                  text: response.result.recallFraming.text,
                  recallFramingFacts: response.result.recallFraming.facts
                }
              : missFallback
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'miss',
          text: missReply.text,
          ...(emptyFuelSegments && preferEmptyFuelCopy ? { textSegments: emptyFuelSegments } : {}),
          ...contextStatusFields,
          ...deeperReadingTipFields,
          ...clueTruncatedTipFields,
          ...(understandingEcho ? { understandingEcho } : {}),
          ...('recallFramingFacts' in missReply && missReply.recallFramingFacts !== undefined
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
      ...(response.result.pipelineTiming ? { pipelineTiming: response.result.pipelineTiming } : {}),
      waitProgress: completedWaitProgress
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
    void nextTick(() => {
      clueInputRef.value?.focus()
    })
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
  // 等待中允许改发 clue（取消上一轮）；出口条仍挡发送
  if (!trimmed || showOutcomeExitStrip.value) {
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

autoSubmitPrefillClue = (clueText: string) => {
  void handleSendTurn(clueText, { skipPivotCheck: true })
}

/** 真正推入用户气泡并召回（已过软岔路口或芯片跳过）。 */
async function commitSendTurn(trimmedClue: string): Promise<void> {
  const trimmed = trimmedClue.trim()
  if (!trimmed) {
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

  // 发送瞬间钉回编辑器，便于改发；出口条 early-return 不走此路径
  void nextTick(() => {
    clueInputRef.value?.focus()
  })

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

/** 软岔路口：把暂存线索放回输入框，不发送。 */
function handleThreadPivotEdit(): void {
  const pending = pendingPivotClue.value ?? ''
  clearThreadPivotStrip()
  clue.value = pending
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
}

/** 软岔路口：丢弃暂存，不发送。 */
function handleThreadPivotDismiss(): void {
  clearThreadPivotStrip()
}

/** 追问芯片：点击即发送一轮（稳定英文 value / 当前 locale label）；跳过软岔路口。 */
function handleUseSuggestion(value: string): void {
  if (!value.trim()) {
    return
  }
  void handleSendTurn(value, { skipPivotCheck: true })
}

/** 理解回声纠错：合成英文 refine → 同追问路径（merge 覆盖/排除）。 */
function handleCorrectUnderstanding(value: string): void {
  handleUseSuggestion(value)
}

/**
 * 关 Side Panel：静默结算 Outcome（不跨次打开补问出口条）。
 * Chrome 无法拦截原生关闭；跨次问「上次找没找到」无上下文、易错愕。
 */
async function handlePanelCloseOutcome(): Promise<void> {
  if (!markOutcomeCloseHandled()) {
    return
  }
  recordVisibleProgressWaitAbandoned('panel_close')
  finalizeOpenDwell()
  await flushOutcomeSession('panel_close', true)
}

/** 取消登录态 storage 订阅。 */
let stopWatchAuthSession: (() => void) | null = null
/** 取消官网登录 UI 态（Connect）订阅。 */
let stopWatchWebsiteAuthUi: (() => void) | null = null
/** 取消浏览器 online/offline 订阅。 */
let stopBrowserOnline: (() => void) | null = null

/** Panel 可见时再刷 Connect / 问候身份（ADR-019 可见性门禁）。 */
function handleSidePanelVisibilityChange(): void {
  if (document.visibilityState !== 'visible') {
    return
  }
  void loadGreetingIdentity()
  void refreshPageContextDomain()
  void refreshBookmarkIngestSetting()
  void probeMemoryLibrary()
}

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
  chrome.storage.onChanged.addListener(handleSidePanelStorageChanged)
  isBrowserOnline.value = readBrowserOnline()
  stopBrowserOnline = subscribeBrowserOnline(online => {
    isBrowserOnline.value = online
  })
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
  void loadOnboardingState()
  void loadGreetingIdentity()
  stopWatchAuthSession = watchAuthSessionStorage(() => {
    void loadGreetingIdentity()
  })
  stopWatchWebsiteAuthUi = watchWebsiteAuthUiStorage(() => {
    if (document.visibilityState !== 'visible') {
      return
    }
    void loadGreetingIdentity()
  })
  document.addEventListener('visibilitychange', handleSidePanelVisibilityChange)
  void (async () => {
    try {
      // Getting Started / Omnibox / 选区预填：写 session 与开壳可能竞态，短窗重试
      const payload = await consumeRecallPrefillWithRetry()
      if (!payload) {
        return
      }
      applyRecallPrefillClue(payload.clue, { autoSubmit: payload.autoSubmit })
    } catch {
      // 忽略：无预填不阻塞 Side Panel
    }
  })()
  void probeMemoryLibrary()
  void refreshBookmarkIngestSetting()
  void refreshPageContextDomain()
  startImportPolling()
  startColdStartPolling()
  void hydrateColdStartPostReleaseDismissed()
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleRecallVisibleProgressPush)
  chrome.storage.onChanged.removeListener(handleSidePanelStorageChanged)
  clearRecallVisibleProgressUi()
  clearColdStartPostReleaseBannerExpiry()
  void handlePanelCloseOutcome()
  recallTelemetry.clearActiveTask()
  recallRequestId += 1
  stopImportPolling()
  stopColdStartPolling()
  stopWatchAuthSession?.()
  stopWatchAuthSession = null
  stopWatchWebsiteAuthUi?.()
  stopWatchWebsiteAuthUi = null
  document.removeEventListener('visibilitychange', handleSidePanelVisibilityChange)
  detachPageContextTabListeners()
  stopBrowserOnline?.()
  stopBrowserOnline = null
})
</script>

<template>
  <AppToastHost />
  <LoginMigrationDialog
    :open="loginMigrationOpen"
    :loading="loginMigrationLoading"
    :error="loginMigrationError"
    :excerpt-count="loginMigrationExcerptCount"
    :bookmark-count="loginMigrationBookmarkCount"
    :delete-after-export-open="loginMigrationDeleteAfterExportOpen"
    @import="runLoginMigrationImport"
    @export="runLoginMigrationExport"
    @delete="runLoginMigrationDelete"
    @later="dismissLoginMigration"
    @dismiss-delete-after-export="dismissDeleteAfterExport"
    @confirm-delete-after-export="runLoginMigrationDelete"
  />
  <main class="recall-shell">
    <ColdStartGate v-if="showColdStartGate && coldStartGateState" :state="coldStartGateState" />

    <header class="recall-header">
      <AppPageHeader
        class="recall-header-top"
        :show-brand="false"
        show-new-find
        :new-find-enabled="hasActiveFindSession && !isRecallRefreshing"
        :session-title="threadFindTitleDisplay"
        :session-title-label="threadFindTitleDisplay ? t('popup_thread_title_label') : null"
        :session-title-aria="threadTitleAria"
        :show-detail-export="
          hasRecallResultCards &&
          !detailExportMode &&
          !showOutcomeExitStrip &&
          !showThreadPivotStrip
        "
        :detail-export-enabled="!isRecallRefreshing"
        :detail-export-label="t('detail_export_start')"
        @navigate-error="handleNavigateError"
        @new-find="startNewFindSession"
        @detail-export="enterDetailExportMode"
      />

      <section
        v-if="showOfflineBanner"
        class="recall-website-connect recall-website-connect--offline"
        role="status"
        aria-live="polite"
        :aria-label="t('sidepanel_offline_banner_aria')"
      >
        <AppIcon class="recall-offline-icon" name="wifi_off" size="18px" aria-hidden="true" />
        <div class="recall-offline-copy">
          <p class="recall-website-connect-label">{{ t('sidepanel_offline_banner') }}</p>
          <p class="recall-offline-mode-chip">{{ t('sidepanel_offline_mode_chip') }}</p>
        </div>
      </section>

      <section
        v-if="showExtensionDisplacedBanner"
        class="recall-website-connect recall-website-connect--displaced"
        role="status"
        aria-live="polite"
      >
        <AppIconButton
          class="recall-website-connect-close"
          type="button"
          :title="t('sidepanel_extension_displaced_dismiss_aria')"
          :aria-label="t('sidepanel_extension_displaced_dismiss_aria')"
          @click="dismissExtensionDisplacedBanner"
        >
          <AppIcon name="close" size="16px" />
        </AppIconButton>
        <p class="recall-website-connect-label">{{ t('sidepanel_extension_displaced_banner') }}</p>
      </section>

      <section
        v-if="showWebsiteConnectBanner"
        class="recall-website-connect"
        role="status"
        aria-live="polite"
      >
        <AppIconButton
          class="recall-website-connect-close"
          type="button"
          :title="t('sidepanel_website_connect_dismiss_aria')"
          :aria-label="t('sidepanel_website_connect_dismiss_aria')"
          @click="closeWebsiteConnectBanner"
        >
          <AppIcon name="close" size="16px" />
        </AppIconButton>
        <p class="recall-website-connect-label">{{ t('sidepanel_website_connect_banner') }}</p>
        <AppButton
          type="button"
          variant="text"
          class="recall-website-connect-cta"
          :disabled="websiteConnectBusy"
          :title="
            websiteConnectBusy
              ? t('sidepanel_website_connect_cta_busy')
              : t('sidepanel_website_connect_cta')
          "
          :aria-label="
            websiteConnectBusy
              ? t('sidepanel_website_connect_cta_busy_aria')
              : t('sidepanel_website_connect_cta_aria')
          "
          @click="connectWebsiteSessionFromBanner"
        >
          {{
            websiteConnectBusy
              ? t('sidepanel_website_connect_cta_busy')
              : t('sidepanel_website_connect_cta')
          }}
        </AppButton>
        <p v-if="websiteConnectError" class="recall-website-connect-error" role="alert">
          {{ websiteConnectError }}
        </p>
      </section>

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

    <div ref="recallScrollRegionRef" class="recall-scroll-region">
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
              <template v-if="idleEmptyCopy?.bodySegments && idleEmptyCopy.bodySegments.length > 0">
                <template
                  v-for="(segment, segmentIndex) in idleEmptyCopy.bodySegments"
                  :key="segmentIndex"
                >
                  <button
                    v-if="segment.kind === 'open_bookmark_ingest_settings'"
                    type="button"
                    class="recall-empty-inline-link"
                    :title="t('popup_empty_import_bookmarks_aria')"
                    :aria-label="t('popup_empty_import_bookmarks_aria')"
                    @click="handleOpenBookmarkIngestSettings"
                  >
                    {{ segment.text }}
                  </button>
                  <template v-else>{{ segment.text }}</template>
                </template>
              </template>
              <template v-else>{{ idleEmptyCopy?.body ?? t('popup_welcome_body') }}</template>
            </p>
            <div v-if="captureFirstMode" class="recall-empty-actions">
              <AppButton type="button" variant="tonal" @click="handleOpenGettingStarted">
                {{ t('popup_open_getting_started') }}
              </AppButton>
              <AppButton
                type="button"
                :disabled="skipOnboardingBusy"
                variant="text"
                @click="handleSkipOnboarding"
              >
                {{ t('popup_skip_onboarding') }}
              </AppButton>
            </div>
            <div v-else-if="showEmptyImportCta" class="recall-empty-actions">
              <AppButton type="button" variant="tonal" @click="handleOpenBookmarkIngestSettings">
                {{ t('popup_empty_import_bookmarks') }}
              </AppButton>
            </div>
            <div v-else-if="showEmptySetupCta" class="recall-empty-actions">
              <AppButton type="button" variant="tonal" @click="handleOpenGettingStarted">
                {{ t('popup_open_getting_started') }}
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
          @correct-understanding="handleCorrectUnderstanding"
          @open-bookmark-ingest-settings="handleOpenBookmarkIngestSettings"
        />
      </div>

      <div v-if="scrollJumpDirection" class="recall-scroll-jump">
        <AppIconButton
          class="recall-scroll-jump__btn"
          type="button"
          :title="scrollJumpLabel"
          :aria-label="scrollJumpLabel"
          @click="handleScrollJump"
        >
          <span
            class="recall-scroll-jump__glyph"
            :class="{ 'recall-scroll-jump__glyph--up': scrollJumpDirection === 'up' }"
            aria-hidden="true"
          >
            <AppIcon name="arrow_downward" size="18px" />
          </span>
        </AppIconButton>
      </div>

      <!-- ChatGPT 式浮底：叠在会话滚动之上；半透明壳下可隐约看见内容 -->
      <div ref="recallFloatDockRef" class="recall-float-dock">
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
          v-if="showThreadPivotStrip"
          class="recall-thread-pivot"
          role="group"
          :aria-label="
            threadFindTitleDisplay
              ? t('popup_thread_pivot_prompt', threadFindTitle || '')
              : t('popup_thread_pivot_prompt_no_title')
          "
        >
          <p class="recall-thread-pivot__prompt">
            {{
              threadFindTitleDisplay
                ? t('popup_thread_pivot_prompt', threadFindTitleDisplay)
                : t('popup_thread_pivot_prompt_no_title')
            }}
          </p>
          <pre v-if="pendingPivotClue" class="recall-thread-pivot__pending">{{
            pendingPivotClue
          }}</pre>
          <div class="recall-thread-pivot__actions">
            <AppButton type="button" variant="filled" @click="handleThreadPivotContinue">
              {{ t('popup_thread_pivot_continue') }}
            </AppButton>
            <AppButton type="button" variant="outlined" @click="handleThreadPivotNew">
              {{ t('popup_thread_pivot_new') }}
            </AppButton>
            <AppButton type="button" variant="outlined" @click="handleThreadPivotEdit">
              {{ t('popup_thread_pivot_edit') }}
            </AppButton>
            <AppButton type="button" variant="text" @click="handleThreadPivotDismiss">
              {{ t('popup_thread_pivot_dismiss') }}
            </AppButton>
          </div>
        </div>

        <div class="recall-bottom-chrome">
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

          <p v-if="showOfflineBanner" class="recall-offline-composer-hint" role="status">
            {{ t('sidepanel_offline_composer_hint') }}
          </p>
          <div class="recall-composer-dock">
            <RecallComposer
              ref="clueInputRef"
              v-model="clue"
              :ariaLabel="t('popup_clue_input_aria')"
              :placeholder="composerPlaceholder"
              :sendLabel="t('popup_submit')"
              :voiceStartLabel="t('sidepanel_voice_start')"
              :voiceStopLabel="t('sidepanel_voice_stop')"
              :voiceUnavailableLabel="t('sidepanel_voice_unavailable')"
              :disabled="showOutcomeExitStrip"
              :prominent="isComposerProminent"
              @send="handleSendTurn"
            >
              <template #leading>
                <RecallPageContextControls
                  :domain="pageContextDomain"
                  :combine-with-page="pageContextCombine"
                  :only-this-site="pageContextOnlySite"
                  :source-scope="recallSourceScope"
                  :expanded="pageContextExpanded"
                  :disabled="showOutcomeExitStrip"
                  :toggle-label="t('sidepanel_recall_settings_toggle')"
                  :dismiss-label="t('sidepanel_recall_settings_dismiss')"
                  :combine-label="t('sidepanel_page_context_combine')"
                  :combine-hint="t('sidepanel_page_context_combine_hint')"
                  :only-site-label="t('sidepanel_page_context_only_site')"
                  :only-site-hint="t('sidepanel_page_context_only_site_hint')"
                  :no-site-hint="t('sidepanel_page_context_no_site_hint')"
                  :source-all-label="t('sidepanel_recall_source_all')"
                  :source-all-hint="t('sidepanel_recall_source_all_hint')"
                  :source-excerpts-label="t('sidepanel_recall_source_excerpts')"
                  :source-excerpts-hint="t('sidepanel_recall_source_excerpts_hint')"
                  :source-bookmarks-label="t('sidepanel_recall_source_bookmarks')"
                  :source-bookmarks-hint="t('sidepanel_recall_source_bookmarks_hint')"
                  @update:expanded="handlePageContextExpanded"
                  @update:combine-with-page="pageContextCombine = $event"
                  @update:only-this-site="pageContextOnlySite = $event"
                  @update:source-scope="recallSourceScope = $event"
                />
              </template>
            </RecallComposer>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
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

:global(html),
:global(body) {
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  margin: 0;
  /* Edge Side Panel：禁止文档被 focus/textarea 长高滚出视口（整页下移） */
  overflow: hidden;
  overflow-anchor: none;
  overscroll-behavior: none;
}

:global(#app) {
  height: 100%;
  max-height: 100%;
  overflow: hidden;
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
  min-height: 0;
  max-height: 100%;

  /* 底边距交给浮底 dock；左右仍给顶栏对齐 */
  padding: var(--space-sm) var(--space-md) 0;
  color: var(--on-surface);
  background: var(--surface);
  overflow: hidden;
  overflow-anchor: none;
}

/* 浮在会话滚动之上；四周留白。勿在壳外再铺实色/渐变遮罩——半透明只在 composer 壳上。 */
.recall-float-dock {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  box-sizing: border-box;
  /* 与 shell 左右 gutter 对齐后再略内收，滚动条可贴面板右缘 */
  padding: 0 calc(var(--space-md) + var(--space-xs)) var(--space-md);
  pointer-events: none;
}

.recall-float-dock > * {
  pointer-events: auto;
}

.recall-bottom-chrome {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: var(--space-sm);
  min-width: 0;
}

.recall-detail-export-bar {
  flex-shrink: 0;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 -4px 16px rgb(0 0 0 / 6%);
  overflow: visible;
}

.recall-outcome-exit {
  display: grid;
  flex-shrink: 0;
  gap: var(--space-xs);
  margin: 0;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-chrome) 88%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.recall-thread-pivot {
  display: grid;
  flex-shrink: 0;
  gap: var(--space-xs);
  margin: 0;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-white) 88%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.recall-thread-pivot__prompt {
  min-width: 0;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface);
  overflow-wrap: anywhere;
}

.recall-thread-pivot__pending {
  box-sizing: border-box;
  max-height: 7.2em;
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--on-surface-muted);
  font: inherit;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
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

.recall-header-top:deep(.app-page-header__nav) {
  gap: 2px;
}

.recall-header-top:deep(.app-icon-button) {
  color: var(--on-surface-muted);
}

.recall-website-connect {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
  margin-bottom: 0;
  padding: var(--space-sm) 2rem var(--space-sm) var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-white);
}

/* 断网薄适配条（ADR-021）：本机提示加强；非故障红、非整壳换肤、非离线产品 */
.recall-website-connect--offline {
  align-items: flex-start;
  padding-right: var(--space-sm);
  border-color: var(--border-strong);
  background: var(--surface-accent-soft);
}

.recall-offline-icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--on-surface);
}

.recall-offline-copy {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 2px;
  min-width: 0;
}

.recall-website-connect--offline .recall-website-connect-label {
  white-space: normal;
  color: var(--on-surface);
  overflow: visible;
  text-overflow: unset;
}

.recall-offline-mode-chip {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.01em;
  color: var(--on-surface-muted);
}

.recall-offline-composer-hint {
  flex-shrink: 0;
  margin: 0 var(--space-2xs);
  font-size: 12px;
  line-height: 1.35;
  color: var(--on-surface-muted);
}

.recall-composer-dock {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

/* 底栏 chrome 的 gap 已管纵向节奏；去掉 composer 内额外上边距避免叠距 */
.recall-bottom-chrome .recall-composer-dock :deep(.recall-form) {
  margin-top: 0;
  padding-top: 0;
}

.recall-website-connect-label {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  color: var(--on-surface-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.recall-website-connect--displaced .recall-website-connect-label {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}

.recall-website-connect-cta {
  flex: 0 0 auto;
  margin: 0;
}

.recall-website-connect-error {
  flex: 1 1 100%;
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--error, #b42318);
}

.recall-website-connect-close {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 28px;
  height: 28px;
}

.recall-post-release {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-sm);
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
  min-width: 0;
  margin: 0;
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

/* 会话滚动区铺满；左右负边距让滚动条贴面板右缘；浮底 composer 叠在上方。 */
.recall-scroll-region {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  margin-right: calc(-1 * var(--space-md));
  margin-left: calc(-1 * var(--space-md));
  /* 由 syncRecallFloatDockClearance 写入；兜底避免首帧裁切 */
  --recall-dock-clearance: 120px;
}

.recall-body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  padding-right: var(--space-md);
  padding-bottom: var(--recall-dock-clearance);
  padding-left: var(--space-md);
  overflow: hidden auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  /* 细滚动条、低对比、贴边（Firefox） */
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--ink) 22%, transparent) transparent;
}

.recall-body::-webkit-scrollbar {
  width: 5px;
}

.recall-body::-webkit-scrollbar-track {
  margin: var(--space-2xs) 0;
  background: transparent;
}

.recall-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 18%, transparent);
  background-clip: padding-box;
  border: 1px solid transparent;
}

.recall-body::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--ink) 32%, transparent);
  background-clip: padding-box;
  border: 1px solid transparent;
}

.recall-body--empty {
  padding-bottom: max(var(--recall-dock-clearance), var(--space-md));
}

.recall-scroll-jump {
  position: absolute;
  right: 0;
  /* clearance 已含 dock 高 + 空隙；再略抬一点避开壳顶 */
  bottom: calc(var(--recall-dock-clearance) - 4px);
  left: 0;
  z-index: 4;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.recall-scroll-jump .recall-scroll-jump__btn {
  width: 36px;
  height: 36px;
  color: var(--on-surface);
  pointer-events: auto;
  background: color-mix(in srgb, var(--surface-white) 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  box-shadow: 0 2px 10px rgb(0 0 0 / 10%);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.recall-scroll-jump .recall-scroll-jump__btn:hover:not(:disabled) {
  color: var(--on-surface);
  background: var(--surface-chrome);
}

.recall-scroll-jump .recall-scroll-jump__btn:active:not(:disabled) {
  background: var(--surface-chrome);
}

/* 方向态旋转（非 hover/focus）；↓ 为基态，↑ = 180° */
.recall-scroll-jump__glyph {
  display: inline-flex;
  transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
}

.recall-scroll-jump__glyph--up {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .recall-scroll-jump__glyph {
    transition: none;
  }
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
  flex: 1 1 auto;
  align-items: center;
  min-height: 120px;
  padding: var(--space-xs) 0;
}

.recall-greeting {
  max-width: 18ch;
  margin: 0;
  font-size: clamp(28px, 7vw, 36px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--on-surface);
  animation: recall-greeting-in var(--motion-duration-medium) var(--motion-easing-emphasized) both;
  text-wrap: balance;
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

.recall-empty-inline-link {
  display: inline;
  padding: 0;
  margin: 0;
  font: inherit;
  line-height: inherit;
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 0.12em;
  cursor: pointer;
  background: none;
  border: none;
}

.recall-empty-inline-link:hover,
.recall-empty-inline-link:focus-visible {
  opacity: 0.85;
  outline: none;
}

.recall-empty-inline-link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary) 45%, transparent);
  outline-offset: 2px;
  border-radius: 2px;
}

.recall-empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: var(--space-2xs) var(--space-xs);
  margin-top: var(--space-2xs);
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

/*
 * Side Panel：随侧栏宽度伸缩；竖向占满可视高度以承载持续对话。
 * 勿再锁 360px（那是旧 Action Popup 约束）。
 */
</style>
