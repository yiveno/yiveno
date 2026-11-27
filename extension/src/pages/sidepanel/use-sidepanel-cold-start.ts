/**
 * Side Panel 冷启动门禁 / 书签导入轮询 / 空态文案 / 首召预填。
 * 从 SidePanel.vue 机械抽出；行为与原文一致。
 */

import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'

/** 门禁可见超过此时长且无进展 → stalled，可「先跳过，直接找」。 */
export const COLD_START_GATE_STALL_MS = 30_000
/** 连续 `fetchColdStartStatus` 失败达到此次数 → 读失败态 + 重试。 */
export const COLD_START_STATUS_READ_FAIL_THRESHOLD = 3

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
  resolveRecallShellBookmarkFuel,
  shouldShowRecallEmptyImportCta,
  shouldShowRecallEmptySetupCta,
  type RecallShellLibraryState
} from '@/core/recall/recall-shell-empty-copy'
import { getTimeOfDayGreeting } from '@/core/recall/time-of-day-greeting'
import { openGettingStartedPage } from '@/infrastructure/browser/extension-pages'
import { focusOrOpenSettingsTab } from '@/infrastructure/browser/extension-tab'
import {
  SETTINGS_HASH_BEHAVIOR_IMPORT,
  SETTINGS_HASH_CHROME_BOOKMARK_SYNC
} from '@/core/settings/settings-sections'
import { t } from '@/infrastructure/i18n/t'
import {
  readColdStartPostReleaseBannerDismissedReadyAt,
  writeColdStartPostReleaseBannerDismissedReadyAt
} from '@/infrastructure/storage/cold-start-post-release-banner-storage'
import {
  fetchBookmarkSyncStaleness,
  fetchChromeBookmarkImportStatus,
  fetchColdStartStatus,
  fetchUserSettings,
  listMemoryItems
} from '@/infrastructure/messaging/background-client'
import {
  consumeRecallPrefill,
  EXCERPT_CAPTURE_COUNT_LOCAL_KEY,
  parseRecallPrefillStorageValue,
  readExcerptCaptureCount,
  RECALL_PREFILL_SESSION_KEY
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import { MEMORY_LIBRARY_REVISION_LOCAL_KEY } from '@/infrastructure/storage/memory-library-revision-storage'
import {
  INSTALL_ONBOARDING_DONE_LOCAL_KEY,
  markInstallOnboardingDone,
  readInstallOnboardingDone
} from '@/infrastructure/storage/install-onboarding-storage'
import { showAppToast } from '@/infrastructure/ui/use-app-toast'

/**
 * 冷启动库探测签名：pipeline / enrichment 批次指纹。
 * 轮询期间相同签名不重复 probe，避免 SW 日志刷屏。
 * `state` 为 null 时返回固定值 `'none'`。
 */
export function coldStartProbeSignature(
  state: ColdStartPipelineState | null,
  batch: ColdStartEnrichmentBatch | null
): string {
  if (!state) {
    return 'none'
  }
  return [
    state.status,
    state.readyAt ?? '',
    batch?.status ?? '',
    String(batch?.settled ?? ''),
    String(batch?.total ?? '')
  ].join('|')
}

/**
 * 书签导入 completed 后触发库探测的状态签名。
 * 同一 completed 快照不重复 probe，避免与 startImportPolling 互重启死循环。
 * `state` 为 null 时返回 `'none'`（无持久化记录，不走 completed 分支）。
 */
export function chromeBookmarkImportProbeSignature(
  state: ChromeBookmarkImportState | null
): string {
  if (!state) {
    return 'none'
  }
  return [
    state.status,
    String(state.importedCount),
    state.completedAt ?? '',
    state.errorCode ?? ''
  ].join('|')
}

/** 导入仍在进行（pending/running）时才应从 probe 启轮询。 */
export function isChromeBookmarkImportInProgress(state: ChromeBookmarkImportState | null): boolean {
  return state?.status === 'pending' || state?.status === 'running'
}

export type UseSidepanelColdStartOptions = {
  /** composer 线索（预填写入）。 */
  clue: Ref<string>
  /** composer 实例，用于预填后聚焦。 */
  clueInputRef: Ref<{ focus: () => void } | null>
  /** 登录展示名；未登录或无名则空，问候退化为仅时段。 */
  accountDisplayName: Ref<string>
  /**
   * 门禁放行后自动提交预填线索。
   * 壳可稍后改写此函数（handleSendTurn 定义之后）。
   */
  onAutoSubmitPrefill: (clue: string) => void
}

export type UseSidepanelColdStartResult = {
  importState: Ref<ChromeBookmarkImportState | null>
  bookmarkIngestEnabled: Ref<boolean>
  coldStartState: Ref<ColdStartPipelineState | null>
  coldStartEnrichmentBatch: Ref<ColdStartEnrichmentBatch | null>
  coldStartPostReleaseDismissedReadyAt: Ref<string | null>
  pendingGsPrefillRecall: Ref<string | null>
  libraryState: Ref<RecallShellLibraryState>
  excerptCaptureCount: Ref<number>
  installOnboardingDone: Ref<boolean>
  skipOnboardingBusy: Ref<boolean>
  showColdStartGate: ComputedRef<boolean>
  coldStartGateState: ComputedRef<ColdStartPipelineState | null>
  /** 门禁可见 ≥30s 且无进展。 */
  coldStartGateStalled: Ref<boolean>
  /** 连续读冷启动状态失败。 */
  coldStartStatusReadFailed: Ref<boolean>
  skipColdStartGateForSession: () => void
  retryColdStartStatusRefresh: () => void
  showColdStartPostReleaseBanner: ComputedRef<boolean>
  coldStartEnrichmentProgressRatio: ComputedRef<number>
  coldStartPostReleaseBannerLabel: ComputedRef<string>
  showColdStartEnrichmentProgressBar: ComputedRef<boolean>
  bookmarkFuel: ComputedRef<ReturnType<typeof resolveRecallShellBookmarkFuel>>
  captureFirstMode: ComputedRef<boolean>
  idleEmptyCopy: ComputedRef<ReturnType<typeof getRecallShellIdleEmptyCopy>>
  showEmptyImportCta: ComputedRef<boolean>
  showEmptySetupCta: ComputedRef<boolean>
  idleGreeting: ComputedRef<string>
  tryFlushPendingGsPrefillRecall: () => void
  applyRecallPrefillClue: (prefill: string, options?: { autoSubmit?: boolean }) => void
  handleRecallPrefillStorageChanged: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => void
  handleLibraryMembershipStorageChanged: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => void
  loadOnboardingState: () => Promise<void>
  handleSkipOnboarding: () => Promise<void>
  handleOpenGettingStarted: () => void
  handleOpenBookmarkIngestSettings: () => void
  /** miss 降级段：打开 Settings AI 分区。 */
  handleOpenAiSettings: () => void
  /** miss 降级段：打开 Settings 账户与同步分区。 */
  handleOpenAccountSettings: () => void
  /** 行为空态：打开 Settings 浏览记录导入锚点。 */
  handleOpenBehaviorImportSettings: () => void
  probeMemoryLibrary: () => Promise<void>
  /** 本机书签语料条数；探测失败为 null。 */
  bookmarkCount: Ref<number | null>
  /**
   * 登录态（由 SidePanel `loadGreetingIdentity` 写入，避免再 fetch）。
   * `null` = 尚未得知。
   */
  signedIn: Ref<boolean | null>
  /** AI 辅助开关；探测失败为 null。 */
  aiFeaturesEnabled: Ref<boolean | null>
  /** 同步关时未进库书签数；探测失败为 null。 */
  unsyncedBookmarkCount: Ref<number | null>
  refreshBookmarkIngestSetting: () => Promise<void>
  startImportPolling: () => void
  stopImportPolling: () => void
  startColdStartPolling: () => void
  stopColdStartPolling: () => void
  clearColdStartPostReleaseBannerExpiry: () => void
  scheduleColdStartPostReleaseBannerExpiry: () => void
  dismissColdStartPostReleaseBanner: () => Promise<void>
  /** onMounted：读 dismiss 记录并预约 TTL。 */
  hydrateColdStartPostReleaseDismissed: () => Promise<void>
}

/** Side Panel 冷启动 / 空态 / 预填：门禁、轮询、燃料态与首召预填。 */
export function useSidepanelColdStart(
  options: UseSidepanelColdStartOptions
): UseSidepanelColdStartResult {
  const { clue, clueInputRef, accountDisplayName, onAutoSubmitPrefill } = options

  const importState = ref<ChromeBookmarkImportState | null>(null)
  /** 书签灌库开关（空库文案分流；默认关与 UserSettings 一致）。 */
  const bookmarkIngestEnabled = ref(false)
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
  /**
   * 本机书签 Memory 条数（与 libraryState 分开：库可因摘录非空，但书签语料仍为 0）。
   * `null` = 未探测或失败。
   */
  const bookmarkCount = ref<number | null>(null)
  /** 由 SidePanel 问候身份探测写入；本 composable 不单独 fetchAuthState。 */
  const signedIn = ref<boolean | null>(null)
  const aiFeaturesEnabled = ref<boolean | null>(null)
  const unsyncedBookmarkCount = ref<number | null>(null)
  const excerptCaptureCount = ref(0)
  const installOnboardingDone = ref(true)
  const skipOnboardingBusy = ref(false)

  let importPollTimer: ReturnType<typeof setInterval> | null = null
  let coldStartPollTimer: ReturnType<typeof setInterval> | null = null
  /** 上次已触发 probe 的冷启动签名；相同则跳过，止轮询刷屏。 */
  let lastColdStartProbeSig: string | null = null
  /** 上次已因 import completed 触发的 probe 签名；相同则跳过。 */
  let lastImportCompletedProbeSig: string | null = null
  /** probe 进行中则后续调用直接返回（不排队）。 */
  let probeInFlight = false

  /** 本 Panel 会话跳过门禁（不写持久化）。 */
  const coldStartGateSessionSkipped = ref(false)
  const coldStartGateStalled = ref(false)
  const coldStartStatusReadFailed = ref(false)
  let coldStartStatusReadFailCount = 0
  let coldStartGateLastProgressSig: string | null = null
  let coldStartGateLastProgressMs: number | null = null
  let coldStartGateStallTimer: ReturnType<typeof setTimeout> | null = null

  const showColdStartGate = computed(() => {
    if (coldStartGateSessionSkipped.value) {
      return false
    }
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
    return (
      coldStartState.value === null && (importStatus === 'running' || importStatus === 'pending')
    )
  })

  /** 门禁进展指纹：pipeline / import 计数变化即算有进展。 */
  function coldStartProgressSignature(): string {
    const state = coldStartState.value
    const imp = importState.value
    return [
      state?.status ?? '',
      state?.stage ?? '',
      String(state?.importImportedCount ?? ''),
      String(state?.importTotalCount ?? ''),
      String(state?.rulesScanned ?? ''),
      String(state?.rulesUpdated ?? ''),
      String(state?.aiEmbedAttempted ?? ''),
      String(state?.aiEmbedWritten ?? ''),
      String(state?.aiLlmEnqueued ?? ''),
      imp?.status ?? '',
      String(imp?.importedCount ?? ''),
      String(imp?.totalCount ?? '')
    ].join('|')
  }

  function clearColdStartGateStallTimer(): void {
    if (coldStartGateStallTimer) {
      clearTimeout(coldStartGateStallTimer)
      coldStartGateStallTimer = null
    }
  }

  function scheduleColdStartGateStallCheck(): void {
    clearColdStartGateStallTimer()
    if (!showColdStartGate.value || coldStartGateSessionSkipped.value) {
      return
    }
    const lastProgressAt = coldStartGateLastProgressMs
    if (lastProgressAt == null) {
      return
    }
    const remaining = COLD_START_GATE_STALL_MS - (Date.now() - lastProgressAt)
    if (remaining <= 0) {
      coldStartGateStalled.value = true
      return
    }
    coldStartGateStallTimer = setTimeout(() => {
      coldStartGateStallTimer = null
      if (showColdStartGate.value && !coldStartGateSessionSkipped.value) {
        coldStartGateStalled.value = true
      }
    }, remaining)
  }

  function noteColdStartGateProgress(): void {
    coldStartGateLastProgressMs = Date.now()
    coldStartGateStalled.value = false
    scheduleColdStartGateStallCheck()
  }

  /** 会话级跳过门禁 + 轻提示；库仍后台准备。 */
  function skipColdStartGateForSession(): void {
    coldStartGateSessionSkipped.value = true
    clearColdStartGateStallTimer()
    coldStartGateStalled.value = false
    showAppToast({
      tone: 'info',
      message: t('cold_start_gate_skip_toast')
    })
  }

  /** 仅重跑状态刷新；不重启 pipeline。 */
  function retryColdStartStatusRefresh(): void {
    void refreshColdStartStatus()
  }

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
    onAutoSubmitPrefill(pending)
  }

  /**
   * 消费预填进 composer。
   * - autoSubmit true：GS Try it / Omnibox 接力 → 门禁后自动提交
   * - autoSubmit false：选区富线索 → 只预填可改，不自动发
   */
  function applyRecallPrefillClue(
    prefill: string,
    prefillOptions?: { autoSubmit?: boolean }
  ): void {
    const trimmed = prefill.trim()
    if (!trimmed) {
      return
    }
    clue.value = trimmed
    if (prefillOptions?.autoSubmit === false) {
      pendingGsPrefillRecall.value = null
      void nextTick(() => {
        clueInputRef.value?.focus()
      })
      return
    }
    pendingGsPrefillRecall.value = trimmed
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
    // 载荷为 { clue, autoSubmit }；兼容旧版纯字符串。清空 / 非法值忽略。
    if (!change || !parseRecallPrefillStorageValue(change.newValue)) {
      return
    }
    void (async () => {
      try {
        const payload = await consumeRecallPrefill()
        if (!payload) {
          return
        }
        applyRecallPrefillClue(payload.clue, { autoSubmit: payload.autoSubmit })
      } catch {
        // 忽略：预填消费失败不挡主壳
      }
    })()
  }

  /**
   * 库成员变更信号：划存 bump `excerptCaptureCount` / `memoryLibraryRevision`；删除 / 清库 bump revision。
   * Panel 一直开着时无 visibilitychange，须靠此把空态 / Capture-first 对齐到最新库态。
   * 仅可见时刷 DOM（与 ADR-019 可见门禁同向）；不可见留给回前台 probe。
   */
  function handleLibraryMembershipStorageChanged(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void {
    if (areaName !== 'local') {
      return
    }
    const membershipTouched =
      EXCERPT_CAPTURE_COUNT_LOCAL_KEY in changes ||
      MEMORY_LIBRARY_REVISION_LOCAL_KEY in changes ||
      INSTALL_ONBOARDING_DONE_LOCAL_KEY in changes
    if (!membershipTouched) {
      return
    }
    if (document.visibilityState !== 'visible') {
      return
    }
    void loadOnboardingState()
    void probeMemoryLibrary()
  }

  watch(showColdStartGate, (blocked, wasBlocked) => {
    if (blocked) {
      coldStartGateLastProgressSig = coldStartProgressSignature()
      noteColdStartGateProgress()
    } else {
      clearColdStartGateStallTimer()
      coldStartGateStalled.value = false
      coldStartGateLastProgressMs = null
      coldStartGateLastProgressSig = null
    }
    if (wasBlocked && !blocked) {
      tryFlushPendingGsPrefillRecall()
    }
  })

  watch([coldStartState, importState], () => {
    if (!showColdStartGate.value) {
      return
    }
    const signature = coldStartProgressSignature()
    if (signature !== coldStartGateLastProgressSig) {
      coldStartGateLastProgressSig = signature
      noteColdStartGateProgress()
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
      return t('cold_start_post_release_banner_paused', [
        String(batch.settled),
        String(batch.total)
      ])
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

  /**
   * 空库燃料态：灌库开关 × 导入状态 → Idle / no_match 文案分流。
   * 主进度仍在 GS；此处只反馈「为何找不到」。
   */
  const bookmarkFuel = computed(() =>
    resolveRecallShellBookmarkFuel({
      bookmarkIngestEnabled: bookmarkIngestEnabled.value,
      importStatus: importState.value?.status ?? null
    })
  )

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
    getRecallShellIdleEmptyCopy(libraryState.value, t, {
      captureFirst: captureFirstMode.value,
      bookmarkFuel: bookmarkFuel.value
    })
  )

  /** 空库 + 未开灌库：Idle 展示导入书签 CTA。 */
  const showEmptyImportCta = computed(() =>
    shouldShowRecallEmptyImportCta({
      library: libraryState.value,
      captureFirst: captureFirstMode.value,
      bookmarkFuel: bookmarkFuel.value
    })
  )

  /** 空库 + 已开灌库但仍空：Idle 回 GS 软后路。 */
  const showEmptySetupCta = computed(() =>
    shouldShowRecallEmptySetupCta({
      library: libraryState.value,
      captureFirst: captureFirstMode.value,
      bookmarkFuel: bookmarkFuel.value
    })
  )

  /** 空线程时占位问候：按时段，有名则带名。 */
  const idleGreeting = computed(() =>
    getTimeOfDayGreeting(t, {
      ...(accountDisplayName.value ? { displayName: accountDisplayName.value } : {})
    })
  )

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

  /** 空库「导入书签」→ Settings 保存分区书签灌库开关。 */
  function handleOpenBookmarkIngestSettings(): void {
    void focusOrOpenSettingsTab({ hash: SETTINGS_HASH_CHROME_BOOKMARK_SYNC })
  }

  /** 偏好空态「导入浏览记录」→ Settings 保存分区行为导入。 */
  function handleOpenBehaviorImportSettings(): void {
    void focusOrOpenSettingsTab({ hash: SETTINGS_HASH_BEHAVIOR_IMPORT })
  }

  function handleOpenAiSettings(): void {
    void focusOrOpenSettingsTab({ section: 'ai' })
  }

  function handleOpenAccountSettings(): void {
    void focusOrOpenSettingsTab({ section: 'account_sync' })
  }

  async function probeMemoryLibrary() {
    // 并发合并：已有一次未完成则直接返回，不排队
    if (probeInFlight) {
      return
    }
    probeInFlight = true
    try {
      const [allResponse, bookmarkResponse, settingsResponse, stalenessResponse] =
        await Promise.all([
          listMemoryItems({ limit: 1 }),
          listMemoryItems({ type: 'bookmark', limit: 1 }),
          fetchUserSettings(),
          fetchBookmarkSyncStaleness()
        ])
      if (!allResponse.ok || !('total' in allResponse)) {
        libraryState.value = 'unknown'
      } else {
        libraryState.value = allResponse.total > 0 ? 'ready' : 'empty'
      }
      // 书签计数失败不阻塞库态；miss 文案按「未知」跳过书签段
      if (!bookmarkResponse.ok || !('total' in bookmarkResponse)) {
        bookmarkCount.value = null
      } else {
        bookmarkCount.value = bookmarkResponse.total
      }
      if (settingsResponse.ok) {
        aiFeaturesEnabled.value = settingsResponse.settings.aiFeaturesEnabled
        bookmarkIngestEnabled.value = settingsResponse.settings.chromeBookmarkIngestEnabled
        // 仅 running/pending 启轮询；completed/failed/无记录为终态，禁止与 refresh 互重启
        if (
          bookmarkIngestEnabled.value &&
          !importPollTimer &&
          isChromeBookmarkImportInProgress(importState.value)
        ) {
          startImportPolling()
        }
      } else {
        aiFeaturesEnabled.value = null
      }
      if (stalenessResponse.ok) {
        unsyncedBookmarkCount.value = stalenessResponse.unsyncedCount
      } else {
        unsyncedBookmarkCount.value = null
      }
    } catch {
      libraryState.value = 'unknown'
      bookmarkCount.value = null
      aiFeaturesEnabled.value = null
      unsyncedBookmarkCount.value = null
    } finally {
      probeInFlight = false
    }
  }

  /** 读取书签灌库开关；失败保持现值，不阻塞空态。 */
  async function refreshBookmarkIngestSetting(): Promise<void> {
    try {
      const response = await fetchUserSettings()
      if (!response.ok) {
        return
      }
      bookmarkIngestEnabled.value = response.settings.chromeBookmarkIngestEnabled
      aiFeaturesEnabled.value = response.settings.aiFeaturesEnabled
      // 用户在 GS 刚打开开关时，确保导入轮询已启动（终态 completed/failed 不启）
      if (bookmarkIngestEnabled.value && !importPollTimer) {
        const status = importState.value?.status
        if (status !== 'completed' && status !== 'failed') {
          startImportPolling()
        }
      }
    } catch {
      // 忽略：缺省关，文案走 ingest_off
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
        // 同一 completed 快照只 probe 一次，切断与 startImportPolling 的互重启
        const nextSig = chromeBookmarkImportProbeSignature(response.state)
        if (nextSig !== lastImportCompletedProbeSig) {
          lastImportCompletedProbeSig = nextSig
          void probeMemoryLibrary()
        }
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
      coldStartStatusReadFailCount += 1
      if (coldStartStatusReadFailCount >= COLD_START_STATUS_READ_FAIL_THRESHOLD) {
        coldStartStatusReadFailed.value = true
      }
      return
    }
    coldStartStatusReadFailCount = 0
    coldStartStatusReadFailed.value = false
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
        // 签名未变则跳过：enrichment 活跃时 400ms 轮询不停，避免每轮打 4 条 SW 消息刷屏
        const nextSig = coldStartProbeSignature(response.state, response.enrichmentBatch)
        if (nextSig !== lastColdStartProbeSig) {
          lastColdStartProbeSig = nextSig
          void probeMemoryLibrary()
        }
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
    clearColdStartGateStallTimer()
  }

  async function hydrateColdStartPostReleaseDismissed(): Promise<void> {
    try {
      coldStartPostReleaseDismissedReadyAt.value =
        await readColdStartPostReleaseBannerDismissedReadyAt()
      scheduleColdStartPostReleaseBannerExpiry()
    } catch {
      // 忽略：无 dismiss 记录不阻塞
    }
  }

  return {
    importState,
    bookmarkIngestEnabled,
    coldStartState,
    coldStartEnrichmentBatch,
    coldStartPostReleaseDismissedReadyAt,
    pendingGsPrefillRecall,
    libraryState,
    bookmarkCount,
    signedIn,
    aiFeaturesEnabled,
    unsyncedBookmarkCount,
    excerptCaptureCount,
    installOnboardingDone,
    skipOnboardingBusy,
    showColdStartGate,
    coldStartGateState,
    coldStartGateStalled,
    coldStartStatusReadFailed,
    skipColdStartGateForSession,
    retryColdStartStatusRefresh,
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
    tryFlushPendingGsPrefillRecall,
    applyRecallPrefillClue,
    handleRecallPrefillStorageChanged,
    handleLibraryMembershipStorageChanged,
    loadOnboardingState,
    handleSkipOnboarding,
    handleOpenGettingStarted,
    handleOpenBookmarkIngestSettings,
    handleOpenBehaviorImportSettings,
    handleOpenAiSettings,
    handleOpenAccountSettings,
    probeMemoryLibrary,
    refreshBookmarkIngestSetting,
    startImportPolling,
    stopImportPolling,
    startColdStartPolling,
    stopColdStartPolling,
    clearColdStartPostReleaseBannerExpiry,
    scheduleColdStartPostReleaseBannerExpiry,
    dismissColdStartPostReleaseBanner,
    hydrateColdStartPostReleaseDismissed
  }
}
