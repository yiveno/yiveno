/**
 * Side Panel 冷启动门禁 / 书签导入轮询 / 空态文案 / 首召预填。
 * 从 SidePanel.vue 机械抽出；行为与原文一致。
 */

import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'

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
import { SETTINGS_HASH_CHROME_BOOKMARK_INGEST } from '@/core/settings/settings-sections'
import { t } from '@/infrastructure/i18n/t'
import {
  readColdStartPostReleaseBannerDismissedReadyAt,
  writeColdStartPostReleaseBannerDismissedReadyAt
} from '@/infrastructure/storage/cold-start-post-release-banner-storage'
import {
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
  markInstallOnboardingDone,
  readInstallOnboardingDone
} from '@/infrastructure/storage/install-onboarding-storage'

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
  probeMemoryLibrary: () => Promise<void>
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
  const excerptCaptureCount = ref(0)
  const installOnboardingDone = ref(true)
  const skipOnboardingBusy = ref(false)

  let importPollTimer: ReturnType<typeof setInterval> | null = null
  let coldStartPollTimer: ReturnType<typeof setInterval> | null = null

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
    return (
      coldStartState.value === null && (importStatus === 'running' || importStatus === 'pending')
    )
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
    onAutoSubmitPrefill(pending)
  }

  /**
   * 消费预填进 composer。
   * - autoSubmit true：GS Try it / Omnibox 接力 → 门禁后自动提交
   * - autoSubmit false：选区富线索 → 只预填可改，不自动发
   */
  function applyRecallPrefillClue(prefill: string, options?: { autoSubmit?: boolean }): void {
    const trimmed = prefill.trim()
    if (!trimmed) {
      return
    }
    clue.value = trimmed
    if (options?.autoSubmit === false) {
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
      EXCERPT_CAPTURE_COUNT_LOCAL_KEY in changes || MEMORY_LIBRARY_REVISION_LOCAL_KEY in changes
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
    void focusOrOpenSettingsTab({ hash: SETTINGS_HASH_CHROME_BOOKMARK_INGEST })
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

  /** 读取书签灌库开关；失败保持现值，不阻塞空态。 */
  async function refreshBookmarkIngestSetting(): Promise<void> {
    try {
      const response = await fetchUserSettings()
      if (!response.ok) {
        return
      }
      bookmarkIngestEnabled.value = response.settings.chromeBookmarkIngestEnabled
      // 用户在 GS 刚打开开关时，确保导入轮询已启动
      if (bookmarkIngestEnabled.value && !importPollTimer) {
        startImportPolling()
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
    excerptCaptureCount,
    installOnboardingDone,
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
    tryFlushPendingGsPrefillRecall,
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
    scheduleColdStartPostReleaseBannerExpiry,
    dismissColdStartPostReleaseBanner,
    hydrateColdStartPostReleaseDismissed
  }
}
