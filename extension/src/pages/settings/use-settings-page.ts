import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import {
  formatExtensionCommandShortcut,
  getExtensionCommandDisplayTitle
} from '@/core/commands/command-display'
import type { ExtensionCommandInfo } from '@/core/messaging/commands-messages'
import type { AuthSignOutMode } from '@/core/messaging/account-sync-messages'
import type { UiLocalePreference } from '@/core/i18n/ui-locale'
import { shouldShowAnonymousCaptchaRetry } from '@/core/identity/anonymous-captcha-retry'
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSectionFromLocationSearch,
  resolveSettingsSectionTab,
  SETTINGS_HASH_BEHAVIOR_IMPORT,
  SETTINGS_HASH_CHROME_BOOKMARK_SYNC,
  SETTINGS_SECTION_TABS,
  type SettingsSectionId
} from '@/core/settings/settings-sections'
import {
  ackPrivacyNotice,
  authSignIn,
  authSignOut,
  clearLocalMemory,
  clearLocalRecallAdaptation,
  clearOrphanOwners,
  deleteAccount,
  deleteCloudMemory,
  clearBehaviorHistoryMessage,
  ensureChromeBookmarksImportedMessage,
  exportLocalMemory,
  fetchBehaviorHistoryImportStatus,
  importBehaviorHistoryMessage,
  exportOrphanOwners,
  fetchAuthState,
  retryAnonymousCaptcha,
  fetchChromeBookmarkImportStatus,
  fetchExtensionCommands,
  fetchSubscriptionStatus,
  fetchSyncStatus,
  fetchUserSettings,
  openChromeShortcutsPage,
  fetchAiHostedQuota,
  fetchDualThreadLearningStatus,
  deleteDualThreadContributedSketches,
  restoreLatestSyncBackup,
  setSyncEnabled,
  setMcpReadOnly,
  runIncrementalMemorySync,
  updateUserSettings,
  importLocalMemory,
  importThirdPartyCorpus,
  fetchThirdPartyCorpusSummary,
  deleteThirdPartyCorpusBySource
} from '@/infrastructure/messaging/background-client'
import type { DualThreadAggregateSketch } from '@/core/recall/dual-thread/dual-thread-aggregate'
import {
  hasAnyFailureStageCounts,
  resolveDualThreadContributeBlockReason,
  resolveDualThreadContributionDisplay,
  type DualThreadContributeBlockReason,
  type DualThreadSketchUploadState
} from '@/core/recall/dual-thread/dual-thread-consent'
import type { BehaviorHistoryImportState } from '@/core/behavior/behavior-history-import-state'
import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import type { ThirdPartyCorpusSource } from '@/core/memory/third-party-corpus-source'
import type { ImportErrorCode } from '@/core/messaging/import-messages'
import { formatLibrarySavedAt } from '@/infrastructure/i18n/format-library-saved-at'
import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'
import { watchWebsiteAuthUiStorage } from '@/infrastructure/auth/watch-website-auth-ui-storage'
import { readWebsiteAuthUiState } from '@/infrastructure/auth/website-auth-ui-storage'
import { useLoginMigrationDialog } from '@/pages/shared/use-login-migration-dialog'
import {
  tAccountSyncError,
  tChromeBookmarkImportError,
  tCommandsError,
  tImportError,
  tLocalMemoryImportError,
  tSettingsError,
  tThirdPartyImportError
} from '@/infrastructure/i18n/background-error'
import { resolveChromeBookmarkImportStatusView } from '@/pages/settings/chrome-bookmark-import-status-copy'
import {
  resolveThirdPartyDeleteMode,
  resolveThirdPartySourceStatusView,
  type ThirdPartyCorpusSummaryView,
  type ThirdPartyDeleteMode
} from '@/pages/settings/third-party-source-status-copy'
import { t } from '@/infrastructure/i18n/t'
import { readBrowserOnline } from '@/infrastructure/browser/browser-online'
import { getWebsiteBaseUrl } from '@/infrastructure/browser/website-page'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'
import {
  readSettingsSectionFromLocation,
  resolveSettingsHistoryWriteMode,
  writeSettingsSectionToHistory
} from '@/pages/settings/settings-page-url-sync'
import {
  shouldRefreshExtensionCommandsOnVisibility,
  shouldRefreshSyncContextOnVisibility
} from '@/pages/settings/settings-visibility-refresh'

/** 设置页状态与动作（从 Settings.vue 拆出，供分区子组件复用）。 */
export function useSettingsPage() {
  const { success: showToastSuccess, error: showToastError } = useAppToast()

  type SettingsLoadState = 'loading' | 'ready' | 'error'

  /** 启动时从 URL 解析当前分区。 */
  const activeSection = ref<SettingsSectionId>(
    parseSettingsSectionFromLocationSearch(window.location.search)
  )

  /** 首屏 URL 同步用 replace，避免多占一条 history。 */
  const hasCompletedInitialSectionSync = ref(false)
  /** popstate 恢复分区时跳过写 history，防止与浏览器栈冲突。 */
  let syncingFromPopstate = false

  const commands = ref<ExtensionCommandInfo[]>([])
  const commandsState = ref<SettingsLoadState>('loading')
  const commandsError = ref('')
  const openingShortcuts = ref(false)
  const openShortcutsError = ref('')
  /** 已打开原生快捷键页，待用户返回后静默刷新绑定。 */
  const awaitingShortcutsReturn = ref(false)

  const selectionToolbarEnabled = ref(true)
  /** 只读：是否已授权一次性导入（控制「重新导入」显隐）。 */
  const chromeBookmarkIngestEnabled = ref(false)
  const chromeBookmarkSyncEnabled = ref(false)
  const aiFeaturesEnabled = ref(true)
  const linkStatusSweepEnabled = ref(true)
  const mcpReadOnlyEnabled = ref(false)
  const recallOutcomePairSoftAdjustEnabled = ref(true)
  const dualThreadLocalLearningEnabled = ref(false)
  const dualThreadContributeAggregatesEnabled = ref(false)
  const dualThreadLearningSketch = ref<DualThreadAggregateSketch | null>(null)
  const dualThreadUploadState = ref<DualThreadSketchUploadState>({
    lastSuccessAtIso: null,
    lastAttemptFailed: false
  })
  const dualThreadLearningLoading = ref(false)
  const dualThreadLearningError = ref('')
  const dualThreadDeleteWorking = ref(false)
  const dualThreadDeleteError = ref('')
  const uiLocalePreference = ref<UiLocalePreference>('system')
  const settingsState = ref<SettingsLoadState>('loading')
  const settingsError = ref('')
  const savingSelectionToolbar = ref(false)
  const savingChromeBookmarkSync = ref(false)
  const reimportChromeBookmarksBusy = ref(false)
  const reimportChromeBookmarksDone = ref(false)
  const behaviorImportState = ref<BehaviorHistoryImportState | null>(null)
  const behaviorImportBusy = ref(false)
  const behaviorClearBusy = ref(false)
  const behaviorClearDone = ref(false)
  let behaviorImportPollTimer: ReturnType<typeof setInterval> | null = null
  let behaviorClearDoneTimer: ReturnType<typeof setTimeout> | null = null
  let reimportDoneTimer: ReturnType<typeof setTimeout> | null = null
  const savingAiFeatures = ref(false)
  const savingLinkStatusSweep = ref(false)
  const savingMcpReadOnly = ref(false)
  const savingRecallOutcomeSoftAdjust = ref(false)
  const savingDualThreadLocalLearning = ref(false)
  const savingDualThreadContribute = ref(false)
  const savingUiLocale = ref(false)
  const hostedQuotaLoading = ref(false)
  const hostedQuotaText = ref('')
  const hostedQuotaError = ref('')
  /** 匿名试用配额数字（拉取失败则静默不展示） */
  const trialLlmRemaining = ref<number | null>(null)
  const trialLlmLimit = ref<number | null>(null)
  const trialEmbedRemaining = ref<number | null>(null)
  const trialEmbedLimit = ref<number | null>(null)
  /** 绑定 OTP 共享弹窗（表单自持于 BindOtpModal） */
  const bindOtpModalOpen = ref(false)

  const signedIn = ref(false)
  const accountEmail = ref('')
  const accountDisplayName = ref('')
  /** device session 匿名试用 */
  const isAnonymous = ref(false)
  /** Turnstile 曾失败 → Settings 前景重试 */
  const anonymousCaptchaRetryNeeded = ref(false)
  const retryingAnonymousCaptcha = ref(false)
  /** 扩展当前绑定账号 id（与官网 UI 桥 userId 对照） */
  const accountId = ref<string | null>(null)
  /** 官网 UI 桥登录态 userId（无桥行则为 null） */
  const websiteAuthUserId = ref<string | null>(null)
  const subscriptionIsPro = ref(false)
  /** 扩展与官网登录账号不一致 */
  const websiteAccountMismatch = computed(() => {
    if (!signedIn.value || !accountId.value) {
      return false
    }
    const websiteId = websiteAuthUserId.value?.trim()
    if (!websiteId) {
      return false
    }
    return websiteId !== accountId.value
  })
  const showAnonymousCaptchaRetry = computed(() =>
    shouldShowAnonymousCaptchaRetry({
      signedIn: signedIn.value,
      isAnonymous: isAnonymous.value,
      anonymousCaptchaRetryNeeded: anonymousCaptchaRetryNeeded.value
    })
  )

  const syncEnabled = ref(false)
  const syncLocalCount = ref(0)
  const syncAccountOwnerCount = ref(0)
  const syncLocalProfileOwnerCount = ref(0)
  const syncRemoteCount = ref(0)
  const orphanBucketCount = ref(0)
  const orphanActiveCount = ref(0)
  const orphanWorking = ref(false)
  const savingSync = ref(false)
  const runningIncrementalSync = ref(false)
  const restoringSyncBackup = ref(false)
  const syncLastPulledAt = ref<string | null>(null)
  const privacyNoticeAcked = ref(false)
  const dataWorking = ref(false)
  const dataError = ref('')
  const exportWorking = ref(false)
  const thirdPartyImportWorking = ref(false)
  const thirdPartyDeleteWorking = ref(false)
  /** 两来源条数 + 最近导入状态；加载失败时为 null（仍可导入）。 */
  const thirdPartyCorpusSummary = ref<ThirdPartyCorpusSummaryView | null>(null)
  /** 第三方摘要加载中（加载中不清空旧 summary）。 */
  const thirdPartySummaryLoading = ref(false)
  const pendingThirdPartyDeleteSource = ref<ThirdPartyCorpusSource | null>(null)
  /** 确认框删除模式：有条目 / 仅清导入记录；关闭时与 source 同清。 */
  const pendingThirdPartyDeleteMode = ref<'items' | 'record' | null>(null)
  /** Chrome 书签导入状态（capture 区状态行 / 轮询）。 */
  const chromeBookmarkImportState = ref<ChromeBookmarkImportState | null>(null)
  const chromeBookmarkImportQueryFailed = ref(false)
  const chromeBookmarkImportErrorCode = ref<ImportErrorCode | null>(null)
  /** 书签导入进度轮询定时器（仅 capture + running/pending）。 */
  let bookmarkImportPollTimer: ReturnType<typeof setInterval> | null = null
  /** 分区内登录进行中。 */
  const signingIn = ref(false)
  const restoreWorking = ref(false)
  const raindropFileInputRef = ref<HTMLInputElement | null>(null)
  const pocketFileInputRef = ref<HTMLInputElement | null>(null)
  const restoreFileInputRef = ref<HTMLInputElement | null>(null)

  /** 官网隐私政策 / 服务条款全文 URL。 */
  const websiteBaseUrl = getWebsiteBaseUrl()
  const privacyPolicyUrl = `${websiteBaseUrl}/privacy`
  const termsOfServiceUrl = `${websiteBaseUrl}/terms`
  const pricingUrl = `${websiteBaseUrl}/pricing`
  const faqUrl = `${websiteBaseUrl}/faq`
  /** Support 已并入 FAQ Contact（官网 `/support` 软跳同锚点） */
  const supportUrl = `${websiteBaseUrl}/faq#contact`

  const signOutDialogOpen = ref(false)
  /** 退出时 opt-in：删本机账号桶摘录（默认不勾选） */
  const signOutDeleteLocalExcerpts = ref(false)
  /** flush_then_keep 失败后展示导出 / 仍退出 */
  const signOutFlushFailed = ref(false)
  const deleteAccountDialogOpen = ref(false)
  /** 通用危险/确认弹窗（替代 window.confirm） */
  type SettingsConfirmAction =
    | 'clear_local'
    | 'clear_recall_adaptation'
    | 'delete_cloud'
    | 'clear_orphans'
    | 'privacy_sync'
    | 'restore_backup'
    | 'delete_third_party'

  const confirmDialogAction = ref<SettingsConfirmAction | null>(null)
  const confirmDialogError = ref('')
  /** privacy_sync 确认后继续执行的开关目标值 */
  const pendingSyncEnable = ref<boolean | null>(null)
  const signingOut = ref(false)
  const signOutError = ref('')

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

  /** 退出相关：本机当前账号桶 + 未 remap 的本地档。 */
  const signOutLocalCount = computed(
    () => syncAccountOwnerCount.value + syncLocalProfileOwnerCount.value
  )

  const hasOrphanOwners = computed(() => orphanBucketCount.value > 0)

  /** Pro 且同步曾开启：主按钮先 flush 再留库 */
  const showSignOutFlushAction = computed(
    () => subscriptionIsPro.value && syncEnabled.value && signOutLocalCount.value > 0
  )

  /** 可选：退出时清除本机账号桶（强确认路径） */
  const showSignOutClearAction = computed(() => signOutLocalCount.value > 0)

  const commandRows = computed(() =>
    commands.value.map(command => ({
      name: command.name,
      title: getExtensionCommandDisplayTitle(command, t),
      shortcutLabel: formatExtensionCommandShortcut(command.shortcut, t),
      unbound: command.shortcut.trim().length === 0
    }))
  )

  const activeSectionTab = computed(() => resolveSettingsSectionTab(activeSection.value))
  const activeSectionLabel = computed(() => t(activeSectionTab.value.labelKey))

  const settingsSectionTabsId = useId()
  const settingsPanelId = `${settingsSectionTabsId}-panel`
  const settingsActiveTabId = computed(() => `${settingsSectionTabsId}-tab-${activeSection.value}`)

  const settingsSectionTabItems = computed(() =>
    SETTINGS_SECTION_TABS.map(tab => ({
      id: tab.id,
      label: t(tab.labelKey)
    }))
  )

  /** 将当前分区同步到 `?section=`（默认 capture 不写 query）。 */
  function syncActiveSectionToUrl(section: SettingsSectionId): void {
    const writeMode = resolveSettingsHistoryWriteMode({
      isInitialSync: !hasCompletedInitialSectionSync.value,
      fromPopstate: syncingFromPopstate
    })
    if (writeMode === 'skip') {
      return
    }
    writeSettingsSectionToHistory(section, window.location, window.history, writeMode)
  }

  /** 浏览器后退/前进：从 URL 恢复侧栏选中态。 */
  function handlePopState(): void {
    syncingFromPopstate = true
    try {
      const next = readSettingsSectionFromLocation(window.location)
      if (next !== activeSection.value) {
        activeSection.value = next
      }
    } finally {
      syncingFromPopstate = false
    }
  }

  watch(
    activeSection,
    section => {
      // P1-9：切分区清空设置错误，避免跨分区残留
      settingsError.value = ''
      syncActiveSectionToUrl(section)
      hasCompletedInitialSectionSync.value = true
      if (section === 'ai') {
        void loadHostedQuota()
      }
      if (section === 'third_party') {
        void loadThirdPartyCorpusSummary()
      }
      if (section === 'privacy') {
        void loadDualThreadLearningStatus()
      }
      if (section === 'capture') {
        void loadChromeBookmarkImportStatus()
        void refreshBehaviorImportStatus()
      } else {
        stopBookmarkImportPolling()
        stopBehaviorImportPolling()
      }
    },
    { immediate: true }
  )

  /** 加载第三方语料两来源摘要；失败时置 null，不弹错；加载中保留旧 summary。 */
  async function loadThirdPartyCorpusSummary(): Promise<void> {
    thirdPartySummaryLoading.value = true
    try {
      const response = await fetchThirdPartyCorpusSummary()
      if (!response.ok) {
        thirdPartyCorpusSummary.value = null
        return
      }
      thirdPartyCorpusSummary.value = response.sources
    } catch {
      thirdPartyCorpusSummary.value = null
    } finally {
      thirdPartySummaryLoading.value = false
    }
  }

  /** 状态行文案：经 resolver 决策后再 t() 渲染。 */
  function thirdPartySourceStatusCopy(source: ThirdPartyCorpusSource): string {
    const view = resolveThirdPartySourceStatusView({
      summary: thirdPartyCorpusSummary.value,
      summaryLoading: thirdPartySummaryLoading.value,
      source
    })
    if (view.kind === 'loading') {
      return t('settings_privacy_working')
    }
    if (view.kind === 'summary_failed') {
      return t('settings_third_party_status_failed')
    }
    if (view.kind === 'not_imported') {
      return t('settings_third_party_not_imported')
    }
    if (view.kind === 'failed_import') {
      const failLabel = view.errorCode
        ? tThirdPartyImportError(view.errorCode)
        : t('error_third_party_import_failed')
      const countPart =
        view.count > 0 ? `${t('settings_third_party_count', [String(view.count)])} · ` : ''
      return `${countPart}${failLabel}`
    }
    const parts = [t('settings_third_party_count', [String(view.count)])]
    if (view.lastImport) {
      const dateLabel = formatLibrarySavedAt(
        view.lastImport.finishedAt ?? view.lastImport.startedAt
      )
      if (dateLabel) {
        parts.push(
          t('settings_third_party_last_import', [dateLabel, String(view.lastImport.importedCount)])
        )
      }
    }
    return parts.join(' · ')
  }

  /** 删除按钮模式：经 resolver 判定 items / record / none。 */
  function thirdPartyDeleteMode(source: ThirdPartyCorpusSource): ThirdPartyDeleteMode {
    return resolveThirdPartyDeleteMode({
      summary: thirdPartyCorpusSummary.value,
      source
    })
  }

  /** 查询 Chrome 书签导入状态；失败时置 queryFailed。 */
  async function loadChromeBookmarkImportStatus(): Promise<void> {
    try {
      const response = await fetchChromeBookmarkImportStatus()
      if (!response.ok) {
        chromeBookmarkImportState.value = null
        chromeBookmarkImportQueryFailed.value = true
        chromeBookmarkImportErrorCode.value = response.errorCode
        return
      }
      chromeBookmarkImportState.value = response.state
      chromeBookmarkImportQueryFailed.value = false
      chromeBookmarkImportErrorCode.value = null
    } catch {
      chromeBookmarkImportState.value = null
      chromeBookmarkImportQueryFailed.value = true
      chromeBookmarkImportErrorCode.value = null
    }
  }

  const chromeBookmarkImportStatusView = computed(() =>
    resolveChromeBookmarkImportStatusView(
      chromeBookmarkImportState.value,
      !chromeBookmarkImportQueryFailed.value,
      chromeBookmarkImportErrorCode.value ?? undefined
    )
  )

  const chromeBookmarkImportStatusKind = computed(() => chromeBookmarkImportStatusView.value.kind)

  /** 书签导入状态行文案（none → 空串；模板靠 kind 决定是否渲染）。 */
  const chromeBookmarkImportStatusCopy = computed(() => {
    const view = chromeBookmarkImportStatusView.value
    if (view.kind === 'none') {
      return ''
    }
    if (view.kind === 'query_failed') {
      return tImportError(view.errorCode ?? 'IMPORT_STATUS_READ_FAILED')
    }
    if (view.kind === 'running') {
      if (view.totalCount != null) {
        return t('settings_chrome_bookmark_import_progress', [
          String(view.importedCount),
          String(view.totalCount)
        ])
      }
      return t('settings_chrome_bookmark_import_progress_unknown')
    }
    if (view.kind === 'completed') {
      return t('settings_chrome_bookmark_import_done', [String(view.importedCount)])
    }
    return tChromeBookmarkImportError(view.errorCode ?? 'BOOKMARK_IMPORT_FAILED')
  })

  /** 重新导入完成提示（带条数）；未完成时为空。 */
  const reimportChromeBookmarksDoneText = computed(() => {
    if (!reimportChromeBookmarksDone.value || chromeBookmarkImportState.value == null) {
      return ''
    }
    return t('settings_reimport_chrome_bookmarks_done_count', [
      String(chromeBookmarkImportState.value.importedCount)
    ])
  })

  /** 仅在 capture 且导入进行中时轮询（1500ms）。 */
  function startBookmarkImportPolling(): void {
    stopBookmarkImportPolling()
    bookmarkImportPollTimer = setInterval(() => {
      const status = chromeBookmarkImportState.value?.status
      if (activeSection.value !== 'capture' || (status !== 'running' && status !== 'pending')) {
        stopBookmarkImportPolling()
        return
      }
      void loadChromeBookmarkImportStatus()
    }, 1500)
  }

  function stopBookmarkImportPolling(): void {
    if (bookmarkImportPollTimer !== null) {
      clearInterval(bookmarkImportPollTimer)
      bookmarkImportPollTimer = null
    }
  }

  /** 前景打开 Turnstile 页，重试匿名 ensure。 */
  async function handleRetryAnonymousCaptcha(): Promise<void> {
    if (retryingAnonymousCaptcha.value || !showAnonymousCaptchaRetry.value) {
      return
    }
    retryingAnonymousCaptcha.value = true
    try {
      const response = await retryAnonymousCaptcha()
      if (!response.ok) {
        showToastError(t('settings_anonymous_captcha_retry_failed'))
        return
      }
      if (response.outcome === 'created' || response.outcome === 'already') {
        anonymousCaptchaRetryNeeded.value = false
        await loadSyncContext()
        return
      }
      showToastError(t('settings_anonymous_captcha_retry_failed'))
      anonymousCaptchaRetryNeeded.value = true
    } catch {
      showToastError(t('settings_anonymous_captcha_retry_failed'))
    } finally {
      retryingAnonymousCaptcha.value = false
    }
  }

  /** 账号分区内登录（官网 handoff；成功后由 watchAuthSessionStorage 刷新）。 */
  async function handleSignIn(): Promise<void> {
    if (signingIn.value) {
      return
    }
    signingIn.value = true
    try {
      const response = await authSignIn()
      if (!response.ok) {
        showToastError(t('settings_error_auth_sign_in'))
      }
    } catch {
      showToastError(t('settings_error_auth_sign_in'))
    } finally {
      signingIn.value = false
    }
  }

  /** 隐私同步确认弹窗：正文下隐私政策外链。 */
  const confirmDialogBodyLinkHref = computed(() =>
    confirmDialogAction.value === 'privacy_sync' ? privacyPolicyUrl : undefined
  )
  const confirmDialogBodyLinkLabel = computed(() =>
    confirmDialogAction.value === 'privacy_sync' ? t('settings_legal_link_privacy') : undefined
  )

  async function loadCommands(options?: { quiet?: boolean }) {
    const quiet = options?.quiet === true
    if (!quiet) {
      commandsState.value = 'loading'
    }
    commandsError.value = ''

    try {
      const response = await fetchExtensionCommands()
      if (!response.ok) {
        commandsState.value = 'error'
        commandsError.value = tCommandsError(response.errorCode)
        return
      }

      commands.value = response.commands
      commandsState.value = 'ready'
    } catch {
      commandsState.value = 'error'
      commandsError.value = t('settings_error_load_commands')
    }
  }

  /** 从 Chrome 快捷键页回到本页时刷新绑定展示。 */
  function refreshCommandsIfReturnedFromShortcuts() {
    if (
      !shouldRefreshExtensionCommandsOnVisibility({
        documentVisible: document.visibilityState === 'visible',
        awaitingShortcutsReturn: awaitingShortcutsReturn.value
      })
    ) {
      return
    }
    awaitingShortcutsReturn.value = false
    void loadCommands({ quiet: true })
  }

  async function handleOpenShortcutsPage() {
    openingShortcuts.value = true
    openShortcutsError.value = ''

    try {
      const response = await openChromeShortcutsPage()
      if (!response.ok) {
        openShortcutsError.value = tCommandsError(response.errorCode)
        return
      }
      awaitingShortcutsReturn.value = true
    } catch {
      openShortcutsError.value = t('settings_error_open_shortcuts')
    } finally {
      openingShortcuts.value = false
    }
  }

  async function loadUserSettings() {
    settingsState.value = 'loading'
    settingsError.value = ''

    try {
      const response = await fetchUserSettings()
      if (!response.ok) {
        settingsState.value = 'error'
        settingsError.value = tSettingsError(response.errorCode)
        return
      }

      selectionToolbarEnabled.value = response.settings.selectionToolbarEnabled
      chromeBookmarkIngestEnabled.value = response.settings.chromeBookmarkIngestEnabled
      chromeBookmarkSyncEnabled.value = response.settings.chromeBookmarkSyncEnabled
      aiFeaturesEnabled.value = response.settings.aiFeaturesEnabled
      linkStatusSweepEnabled.value = response.settings.linkStatusSweepEnabled
      mcpReadOnlyEnabled.value = response.settings.mcpReadOnlyEnabled
      recallOutcomePairSoftAdjustEnabled.value =
        response.settings.recallOutcomePairSoftAdjustEnabled
      dualThreadLocalLearningEnabled.value = response.settings.dualThreadLocalLearningEnabled
      dualThreadContributeAggregatesEnabled.value =
        response.settings.dualThreadContributeAggregatesEnabled
      uiLocalePreference.value = response.settings.uiLocalePreference
      settingsState.value = 'ready'
      void refreshBehaviorImportStatus()
      if (activeSection.value === 'privacy') {
        void loadDualThreadLearningStatus()
      }
    } catch {
      settingsState.value = 'error'
      settingsError.value = t('settings_error_load')
    }
  }

  async function handleSelectionToolbarToggle(nextValue: boolean) {
    savingSelectionToolbar.value = true
    settingsError.value = ''

    try {
      const response = await updateUserSettings({ selectionToolbarEnabled: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }

      selectionToolbarEnabled.value = response.settings.selectionToolbarEnabled
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingSelectionToolbar.value = false
    }
  }

  /** Chrome 书签持续同步开关（开时会导入现有书签并挂监听）。 */
  async function handleChromeBookmarkSyncToggle(nextValue: boolean) {
    savingChromeBookmarkSync.value = true
    settingsError.value = ''

    try {
      const response = await updateUserSettings({ chromeBookmarkSyncEnabled: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }

      chromeBookmarkSyncEnabled.value = response.settings.chromeBookmarkSyncEnabled
      chromeBookmarkIngestEnabled.value = response.settings.chromeBookmarkIngestEnabled
      await loadChromeBookmarkImportStatus()
      const status = chromeBookmarkImportState.value?.status
      if (status === 'running' || status === 'pending') {
        startBookmarkImportPolling()
      }
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingChromeBookmarkSync.value = false
    }
  }

  /** 重新导入 Chrome 书签（一次性 ensure；尊重墓碑）。 */
  async function handleReimportChromeBookmarks() {
    if (reimportChromeBookmarksBusy.value || !chromeBookmarkIngestEnabled.value) {
      return
    }
    reimportChromeBookmarksBusy.value = true
    reimportChromeBookmarksDone.value = false
    settingsError.value = ''
    if (reimportDoneTimer !== null) {
      clearTimeout(reimportDoneTimer)
      reimportDoneTimer = null
    }

    try {
      const response = await ensureChromeBookmarksImportedMessage()
      if (!response.ok) {
        settingsError.value = t('settings_error_update')
        return
      }
      chromeBookmarkImportState.value = response.state
      chromeBookmarkImportQueryFailed.value = false
      chromeBookmarkImportErrorCode.value = null
      reimportChromeBookmarksDone.value = true
      reimportDoneTimer = setTimeout(() => {
        reimportChromeBookmarksDone.value = false
        reimportDoneTimer = null
      }, 2500)
      if (response.state.status === 'running' || response.state.status === 'pending') {
        startBookmarkImportPolling()
      }
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      reimportChromeBookmarksBusy.value = false
    }
  }

  function stopBehaviorImportPolling(): void {
    if (behaviorImportPollTimer !== null) {
      clearInterval(behaviorImportPollTimer)
      behaviorImportPollTimer = null
    }
  }

  function startBehaviorImportPolling(): void {
    stopBehaviorImportPolling()
    behaviorImportPollTimer = setInterval(() => {
      void refreshBehaviorImportStatus()
    }, 800)
  }

  async function refreshBehaviorImportStatus(): Promise<void> {
    try {
      const response = await fetchBehaviorHistoryImportStatus()
      if (!response.ok) {
        return
      }
      behaviorImportState.value = response.state
      if (response.state?.status === 'running') {
        if (behaviorImportPollTimer === null) {
          startBehaviorImportPolling()
        }
      } else {
        stopBehaviorImportPolling()
        behaviorImportBusy.value = false
      }
    } catch {
      // 轮询失败不打断 UI
    }
  }

  const behaviorImportStatusCopy = computed(() => {
    const state = behaviorImportState.value
    if (!state) {
      return ''
    }
    if (state.status === 'running') {
      return t('settings_behavior_import_progress', [String(state.scannedCount ?? 0)])
    }
    if (state.status === 'completed') {
      return t('settings_behavior_import_done', [String(state.importedCount)])
    }
    if (state.status === 'failed') {
      if (state.errorCode === 'BEHAVIOR_IMPORT_PERMISSION_DENIED') {
        return t('settings_behavior_import_permission_denied')
      }
      return t('settings_behavior_import_failed')
    }
    return ''
  })

  /** 导入浏览记录（含可选 history 权限请求）。 */
  async function handleImportBehaviorHistory() {
    if (behaviorImportBusy.value) {
      return
    }
    behaviorImportBusy.value = true
    settingsError.value = ''
    try {
      const response = await importBehaviorHistoryMessage()
      if (!response.ok) {
        settingsError.value = tImportError(response.errorCode)
        behaviorImportBusy.value = false
        return
      }
      behaviorImportState.value = response.state
      if (response.state.status === 'running') {
        startBehaviorImportPolling()
      } else {
        behaviorImportBusy.value = false
      }
    } catch {
      settingsError.value = t('settings_error_update')
      behaviorImportBusy.value = false
    }
  }

  /** 清除当前 owner 行为数据。 */
  async function handleClearBehaviorHistory() {
    if (behaviorClearBusy.value) {
      return
    }
    behaviorClearBusy.value = true
    behaviorClearDone.value = false
    settingsError.value = ''
    if (behaviorClearDoneTimer !== null) {
      clearTimeout(behaviorClearDoneTimer)
      behaviorClearDoneTimer = null
    }
    try {
      const response = await clearBehaviorHistoryMessage()
      if (!response.ok) {
        settingsError.value = tImportError(response.errorCode)
        return
      }
      behaviorImportState.value = null
      behaviorClearDone.value = true
      behaviorClearDoneTimer = setTimeout(() => {
        behaviorClearDone.value = false
        behaviorClearDoneTimer = null
      }, 2500)
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      behaviorClearBusy.value = false
    }
  }

  /** AI 功能开关（线索理解 + Capture enrichment）。 */
  async function handleAiFeaturesToggle(nextValue: boolean) {
    savingAiFeatures.value = true
    settingsError.value = ''

    try {
      const response = await updateUserSettings({ aiFeaturesEnabled: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }

      aiFeaturesEnabled.value = response.settings.aiFeaturesEnabled
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingAiFeatures.value = false
    }
  }

  /** 死链巡检开关（不联动 AI；关则卸闹钟）。 */
  async function handleLinkStatusSweepToggle(nextValue: boolean) {
    savingLinkStatusSweep.value = true
    settingsError.value = ''

    try {
      const response = await updateUserSettings({ linkStatusSweepEnabled: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }

      linkStatusSweepEnabled.value = response.settings.linkStatusSweepEnabled
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingLinkStatusSweep.value = false
    }
  }

  /** A 层：暂停 / 恢复本机 Outcome 对软调（不删缓冲）。 */
  async function handleRecallOutcomePairSoftAdjustToggle(nextValue: boolean) {
    savingRecallOutcomeSoftAdjust.value = true
    settingsError.value = ''
    try {
      const response = await updateUserSettings({
        recallOutcomePairSoftAdjustEnabled: nextValue
      })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }
      recallOutcomePairSoftAdjustEnabled.value =
        response.settings.recallOutcomePairSoftAdjustEnabled
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingRecallOutcomeSoftAdjust.value = false
    }
  }

  /** 只读 MCP beta 开关（§5.10.5）；关闭后本机与云端 MCP 均拒绝。 */
  async function handleMcpReadOnlyToggle(nextValue: boolean) {
    savingMcpReadOnly.value = true
    settingsError.value = ''
    dataError.value = ''
    try {
      const response = await updateUserSettings({ mcpReadOnlyEnabled: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }
      mcpReadOnlyEnabled.value = response.settings.mcpReadOnlyEnabled
      if (signedIn.value) {
        const sync = await setMcpReadOnly(nextValue)
        if (!sync.ok) {
          settingsError.value = tAccountSyncError(sync.errorCode)
        }
      }
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingMcpReadOnly.value = false
    }
  }

  /** privacy 分区：现场计算学习记录草图 + 贡献状态。 */
  async function loadDualThreadLearningStatus() {
    dualThreadLearningLoading.value = true
    dualThreadLearningError.value = ''
    try {
      const response = await fetchDualThreadLearningStatus()
      if (!response.ok) {
        dualThreadLearningError.value = t('settings_dual_thread_status_failed')
        dualThreadLearningSketch.value = null
        return
      }
      dualThreadLocalLearningEnabled.value = response.localLearningEnabled
      dualThreadContributeAggregatesEnabled.value = response.contributeEnabled
      dualThreadLearningSketch.value = response.sketch
      dualThreadUploadState.value = response.uploadState
      if (response.signedIn !== signedIn.value) {
        signedIn.value = response.signedIn
      }
    } catch {
      dualThreadLearningError.value = t('settings_dual_thread_status_failed')
      dualThreadLearningSketch.value = null
    } finally {
      dualThreadLearningLoading.value = false
    }
  }

  /** 暗线·本地学习开关。 */
  async function handleDualThreadLocalLearningToggle(nextValue: boolean) {
    savingDualThreadLocalLearning.value = true
    settingsError.value = ''
    try {
      const response = await updateUserSettings({ dualThreadLocalLearningEnabled: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }
      dualThreadLocalLearningEnabled.value = response.settings.dualThreadLocalLearningEnabled
      if (!nextValue) {
        dualThreadLearningSketch.value = null
      } else {
        await loadDualThreadLearningStatus()
      }
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingDualThreadLocalLearning.value = false
    }
  }

  /** 暗线·贡献匿名汇总开关。 */
  async function handleDualThreadContributeToggle(nextValue: boolean) {
    savingDualThreadContribute.value = true
    settingsError.value = ''
    try {
      const response = await updateUserSettings({
        dualThreadContributeAggregatesEnabled: nextValue
      })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }
      dualThreadContributeAggregatesEnabled.value =
        response.settings.dualThreadContributeAggregatesEnabled
      if (nextValue) {
        await loadDualThreadLearningStatus()
      }
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingDualThreadContribute.value = false
    }
  }

  /** 删除已贡献的匿名汇总。 */
  async function handleDeleteDualThreadContributedSketches() {
    dualThreadDeleteWorking.value = true
    dualThreadDeleteError.value = ''
    try {
      const response = await deleteDualThreadContributedSketches()
      if (!response.ok) {
        dualThreadDeleteError.value =
          response.errorCode === 'DUAL_THREAD_DELETE_AUTH_REQUIRED'
            ? t('settings_dual_thread_delete_auth_required')
            : t('settings_dual_thread_delete_failed')
        return
      }
      dualThreadUploadState.value = {
        lastSuccessAtIso: null,
        lastAttemptFailed: false
      }
      showToastSuccess(t('settings_dual_thread_delete_contributed_done'))
    } catch {
      dualThreadDeleteError.value = t('settings_dual_thread_delete_failed')
    } finally {
      dualThreadDeleteWorking.value = false
    }
  }

  const dualThreadContributeBlockReason = computed<DualThreadContributeBlockReason>(() =>
    resolveDualThreadContributeBlockReason({
      localLearningEnabled: dualThreadLocalLearningEnabled.value,
      signedIn: signedIn.value
    })
  )

  const dualThreadContributeDisabled = computed(
    () =>
      dualThreadContributeBlockReason.value != null ||
      savingDualThreadContribute.value ||
      settingsState.value !== 'ready'
  )

  const dualThreadContributeGateText = computed(() => {
    const reason = dualThreadContributeBlockReason.value
    if (reason === 'need_local_learning') return t('settings_dual_thread_need_local_learning')
    if (reason === 'need_sign_in') return t('settings_dual_thread_need_sign_in')
    return ''
  })

  const dualThreadLastContributionText = computed(() => {
    const display = resolveDualThreadContributionDisplay({
      state: dualThreadUploadState.value,
      now: new Date()
    })
    switch (display.kind) {
      case 'failed':
        return t('settings_dual_thread_last_contrib_failed')
      case 'never':
        return t('settings_dual_thread_last_contrib_never')
      case 'today':
        return t('settings_dual_thread_last_contrib_today')
      case 'yesterday':
        return t('settings_dual_thread_last_contrib_yesterday')
      case 'date':
        return t('settings_dual_thread_last_contrib_date', [display.isoDate])
    }
  })

  const dualThreadLearningHasAttributions = computed(() => {
    const sketch = dualThreadLearningSketch.value
    if (!sketch) return false
    return hasAnyFailureStageCounts(sketch.failureStageCounts)
  })

  /**
   * 界面语言偏好；写入 storage 后整页 reload，使所有入口重新 `initUiLocaleFromSettings`。
   */
  async function handleUiLocalePreferenceChange(nextValue: UiLocalePreference) {
    if (nextValue === uiLocalePreference.value) {
      return
    }
    savingUiLocale.value = true
    settingsError.value = ''
    try {
      const response = await updateUserSettings({ uiLocalePreference: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }
      uiLocalePreference.value = response.settings.uiLocalePreference
      window.location.reload()
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingUiLocale.value = false
    }
  }

  /** 刷新托管 Clue LLM 配额展示；匿名试用另填 trial* 数字（失败静默）。 */
  async function loadHostedQuota(): Promise<void> {
    hostedQuotaError.value = ''
    hostedQuotaText.value = ''
    trialLlmRemaining.value = null
    trialLlmLimit.value = null
    trialEmbedRemaining.value = null
    trialEmbedLimit.value = null
    if (!signedIn.value) {
      hostedQuotaText.value = t('settings_ai_quota_sign_in')
      return
    }
    hostedQuotaLoading.value = true
    try {
      const response = await fetchAiHostedQuota()
      if (!response.ok) {
        // 匿名试用区：拉取失败不弹数字、不谎报；AI 区仍可显示错误
        if (!isAnonymous.value) {
          hostedQuotaError.value = tSettingsError(response.errorCode)
        }
        return
      }
      if (response.quota.tier === 'anonymous') {
        trialLlmRemaining.value = response.quota.remaining
        trialLlmLimit.value = response.quota.limit
        if (
          typeof response.quota.embedRemaining === 'number' &&
          typeof response.quota.embedLimit === 'number'
        ) {
          trialEmbedRemaining.value = response.quota.embedRemaining
          trialEmbedLimit.value = response.quota.embedLimit
        }
        // AI 分区摘要：试用档
        hostedQuotaText.value = t('settings_ai_quota_summary', [
          t('settings_trial_account_title'),
          String(response.quota.used),
          String(response.quota.limit),
          String(response.quota.dailyUsed),
          String(response.quota.dailyLimit)
        ])
        return
      }
      hostedQuotaText.value = t('settings_ai_quota_summary', [
        response.quota.tier === 'pro'
          ? t('settings_subscription_tier_pro')
          : t('settings_subscription_tier_free'),
        String(response.quota.used),
        String(response.quota.limit),
        String(response.quota.dailyUsed),
        String(response.quota.dailyLimit)
      ])
    } catch {
      if (!isAnonymous.value) {
        hostedQuotaError.value = readBrowserOnline()
          ? t('settings_ai_quota_failed')
          : t('settings_ai_quota_failed_offline')
      }
    } finally {
      hostedQuotaLoading.value = false
    }
  }

  function openBindOtpModal(): void {
    if (!isAnonymous.value) {
      return
    }
    bindOtpModalOpen.value = true
  }

  function closeBindOtpModal(): void {
    bindOtpModalOpen.value = false
  }

  /** 绑定成功关闭后刷新账号态（含迁移门闸 / 配额）。 */
  async function handleBindOtpSuccess(): Promise<void> {
    await loadSyncContext()
  }

  async function refreshSyncStatus() {
    const response = await fetchSyncStatus()
    if (!response.ok) {
      showToastError(tAccountSyncError(response.errorCode))
      return
    }
    syncEnabled.value = response.syncEnabled
    syncLocalCount.value = response.localCount
    syncAccountOwnerCount.value = response.accountOwnerCount
    syncLocalProfileOwnerCount.value = response.localProfileOwnerCount
    syncRemoteCount.value = response.remoteCount
    orphanBucketCount.value = response.orphanBucketCount
    orphanActiveCount.value = response.orphanActiveCount
    syncLastPulledAt.value = response.lastPulledAt ?? null
    privacyNoticeAcked.value = response.privacyNoticeAcked
  }

  async function loadSyncContext() {
    try {
      const response = await fetchAuthState()
      if (!response.ok) {
        showToastError(tAccountSyncError(response.errorCode))
        return
      }

      const nextAccountId = response.binding?.accountId?.trim() || null
      const nextIsAnonymous = response.isAnonymous === true

      signedIn.value = response.signedIn
      accountEmail.value = response.email?.trim() ?? ''
      accountDisplayName.value = response.displayName?.trim() ?? ''
      isAnonymous.value = nextIsAnonymous
      anonymousCaptchaRetryNeeded.value = response.anonymousCaptchaRetryNeeded === true
      accountId.value = nextAccountId
      syncEnabled.value = response.syncPrefs.enabled
      await refreshWebsiteAuthMismatch()

      // 未登录也要盘点孤儿桶（换号退出后残留仍可见）
      await refreshSyncStatus()
      await loadSubscriptionStatus()
      if (response.signedIn) {
        await refreshLoginMigrationGate()
      }
      // AI 分区摘要；匿名试用数字也在账号区展示 → 已登录即拉
      if (response.signedIn) {
        await loadHostedQuota()
      }
    } catch {
      showToastError(t('settings_error_auth_state'))
    }
  }

  /** 加载订阅快照（仅门禁用 isPro；升级/管理在官网）。 */
  async function loadSubscriptionStatus(forceRefresh = false): Promise<void> {
    try {
      const response = await fetchSubscriptionStatus(forceRefresh ? { refresh: true } : undefined)
      if (!response.ok) {
        showToastError(tAccountSyncError(response.errorCode))
        return
      }
      subscriptionIsPro.value = response.snapshot.isPro
    } catch {
      showToastError(t('settings_error_subscription_status'))
    }
  }

  /** 下载孤儿桶 JSON 备份。 */
  function downloadOrphanExportJson(items: unknown[]): void {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2)],
      {
        type: 'application/json'
      }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `yiveno-orphan-owners-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** 下载当前 owner 本机记忆 JSON（含 L3；formatVersion 仅文件信封，不进 SW 响应）。 */
  function downloadLocalMemoryExportJson(
    ownerId: string,
    items: unknown[],
    memoryNotes: unknown[],
    memoryNotesMeta: unknown
  ): void {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            formatVersion: 1,
            exportedAt: new Date().toISOString(),
            ownerId,
            items,
            memoryNotes,
            memoryNotesMeta
          },
          null,
          2
        )
      ],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `yiveno-memory-export-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportOrphans() {
    orphanWorking.value = true
    try {
      const response = await exportOrphanOwners()
      if (!response.ok) {
        showToastError(tAccountSyncError(response.errorCode))
        return
      }
      downloadOrphanExportJson(response.items)
      showToastSuccess(t('settings_orphan_exported', [String(response.items.length)]))
    } catch {
      showToastError(t('settings_error_orphan_export'))
    } finally {
      orphanWorking.value = false
    }
  }

  async function handleClearOrphans() {
    if (orphanWorking.value || signingOut.value || savingSync.value) {
      return
    }
    confirmDialogError.value = ''
    confirmDialogAction.value = 'clear_orphans'
  }

  async function executeClearOrphans(): Promise<boolean> {
    orphanWorking.value = true
    try {
      const response = await clearOrphanOwners()
      if (!response.ok) {
        confirmDialogError.value = tAccountSyncError(response.errorCode)
        return false
      }
      showToastSuccess(
        t('settings_orphan_cleared', [
          String(response.clearedBuckets),
          String(response.clearedItems)
        ])
      )
      await refreshSyncStatus()
      return true
    } catch {
      confirmDialogError.value = t('settings_error_orphan_clear')
      return false
    } finally {
      orphanWorking.value = false
    }
  }

  /** 从其它标签（如官网登录）返回时刷新同步相关登录态。 */
  function refreshSyncContextOnVisible() {
    if (!shouldRefreshSyncContextOnVisibility(document.visibilityState === 'visible')) {
      return
    }
    // 从官网定价返回时强制刷新订阅快照
    void loadSyncContext().then(() => loadSubscriptionStatus(true))
  }

  function handleDocumentVisibilityChange() {
    refreshCommandsIfReturnedFromShortcuts()
    refreshSyncContextOnVisible()
  }

  async function handleSyncToggle(nextValue: boolean) {
    if (!signedIn.value) {
      showToastError(t('settings_sync_sign_in_required'))
      return
    }
    if (nextValue && !subscriptionIsPro.value) {
      showToastError(t('settings_error_sync_pro_required'))
      return
    }

    savingSync.value = true
    try {
      if (nextValue && !privacyNoticeAcked.value) {
        pendingSyncEnable.value = nextValue
        confirmDialogError.value = ''
        confirmDialogAction.value = 'privacy_sync'
        return
      }

      const response = await setSyncEnabled(nextValue)
      if (!response.ok) {
        showToastError(tAccountSyncError(response.errorCode))
        return
      }
      syncEnabled.value = response.syncPrefs.enabled
      await refreshSyncStatus()
    } catch {
      showToastError(t('settings_error_sync_prefs'))
    } finally {
      savingSync.value = false
    }
  }

  /** 删除云端记忆（不动本机）。 */
  function handleDeleteCloudMemory() {
    if (!signedIn.value || dataWorking.value) {
      return
    }
    confirmDialogError.value = ''
    confirmDialogAction.value = 'delete_cloud'
  }

  async function executeDeleteCloudMemory(): Promise<boolean> {
    dataWorking.value = true
    dataError.value = ''
    try {
      const response = await deleteCloudMemory()
      if (!response.ok) {
        confirmDialogError.value = tAccountSyncError(response.errorCode)
        return false
      }
      showToastSuccess(t('settings_privacy_delete_cloud_done', [String(response.deletedItems)]))
      syncEnabled.value = false
      await refreshSyncStatus()
      return true
    } catch {
      confirmDialogError.value = t('settings_error_cloud_delete')
      return false
    } finally {
      dataWorking.value = false
    }
  }

  /** 打开删除账号确认弹窗。 */
  function openDeleteAccountDialog() {
    if (!signedIn.value || dataWorking.value || signingOut.value) {
      return
    }
    dataError.value = ''
    deleteAccountDialogOpen.value = true
  }

  function closeDeleteAccountDialog() {
    if (dataWorking.value) {
      return
    }
    deleteAccountDialogOpen.value = false
  }

  /** 删除账号：云 + Auth + 本机账号桶 + 退登。 */
  async function confirmDeleteAccount() {
    if (!signedIn.value || dataWorking.value || signingOut.value) {
      return
    }

    dataWorking.value = true
    dataError.value = ''
    try {
      const response = await deleteAccount()
      if (!response.ok) {
        dataError.value = tAccountSyncError(response.errorCode)
        return
      }
      deleteAccountDialogOpen.value = false
      showToastSuccess(
        t('settings_privacy_delete_account_done', [
          String(response.deletedItems),
          String(response.clearedLocalCount)
        ])
      )
      signedIn.value = false
      accountEmail.value = ''
      accountDisplayName.value = ''
      syncEnabled.value = false
      privacyNoticeAcked.value = false
      await refreshSyncStatus()
    } catch {
      dataError.value = t('settings_error_account_delete')
    } finally {
      dataWorking.value = false
    }
  }

  const confirmDialogOpen = computed(() => confirmDialogAction.value !== null)

  const confirmDialogTitle = computed(() => {
    switch (confirmDialogAction.value) {
      case 'clear_local':
        return t('settings_data_clear_local')
      case 'clear_recall_adaptation':
        return t('settings_data_clear_recall_adaptation')
      case 'delete_cloud':
        return t('settings_privacy_delete_cloud')
      case 'clear_orphans':
        return t('settings_orphan_clear')
      case 'privacy_sync':
        return t('settings_sync_toggle')
      case 'restore_backup':
        return t('settings_sync_restore_backup')
      case 'delete_third_party':
        return pendingThirdPartyDeleteMode.value === 'record'
          ? t('settings_third_party_clear_record')
          : t('settings_third_party_delete_all')
      default:
        return ''
    }
  })

  const confirmDialogBody = computed(() => {
    switch (confirmDialogAction.value) {
      case 'clear_local':
        return t('settings_data_clear_local_confirm')
      case 'clear_recall_adaptation':
        return t('settings_data_clear_recall_adaptation_confirm')
      case 'delete_cloud':
        return t('settings_privacy_delete_cloud_confirm')
      case 'clear_orphans':
        return t('settings_orphan_clear_confirm', [
          String(orphanBucketCount.value),
          String(orphanActiveCount.value)
        ])
      case 'privacy_sync':
        return t('settings_privacy_sync_confirm')
      case 'restore_backup':
        return t('settings_sync_restore_backup_confirm')
      case 'delete_third_party': {
        const source = pendingThirdPartyDeleteSource.value
        const sourceLabel = source === 'pocket' ? 'Pocket' : 'Raindrop'
        if (pendingThirdPartyDeleteMode.value === 'record') {
          return t('settings_third_party_clear_record_confirm', [sourceLabel])
        }
        const count = source ? (thirdPartyCorpusSummary.value?.[source]?.count ?? 0) : 0
        return t('settings_third_party_delete_confirm', [String(count), sourceLabel])
      }
      default:
        return ''
    }
  })

  const confirmDialogTone = computed<'default' | 'danger'>(() => {
    const action = confirmDialogAction.value
    return action === 'clear_local' ||
      action === 'clear_recall_adaptation' ||
      action === 'delete_cloud' ||
      action === 'clear_orphans' ||
      action === 'delete_third_party'
      ? 'danger'
      : 'default'
  })

  const confirmDialogLoading = computed(() => {
    switch (confirmDialogAction.value) {
      case 'clear_local':
      case 'clear_recall_adaptation':
      case 'delete_cloud':
        return dataWorking.value
      case 'clear_orphans':
        return orphanWorking.value
      case 'privacy_sync':
        return savingSync.value
      case 'restore_backup':
        return restoringSyncBackup.value
      case 'delete_third_party':
        return thirdPartyDeleteWorking.value
      default:
        return false
    }
  })

  function closeConfirmDialog() {
    if (confirmDialogLoading.value) {
      return
    }
    confirmDialogAction.value = null
    confirmDialogError.value = ''
    pendingSyncEnable.value = null
    pendingThirdPartyDeleteSource.value = null
    pendingThirdPartyDeleteMode.value = null
  }

  async function executePrivacySyncEnable(): Promise<boolean> {
    const nextValue = pendingSyncEnable.value
    if (nextValue === null) {
      return false
    }

    savingSync.value = true
    try {
      const ack = await ackPrivacyNotice()
      if (!ack.ok) {
        confirmDialogError.value = tAccountSyncError(ack.errorCode)
        return false
      }
      privacyNoticeAcked.value = true

      const response = await setSyncEnabled(nextValue)
      if (!response.ok) {
        confirmDialogError.value = tAccountSyncError(response.errorCode)
        return false
      }
      syncEnabled.value = response.syncPrefs.enabled
      await refreshSyncStatus()
      return true
    } catch {
      confirmDialogError.value = t('settings_error_sync_prefs')
      return false
    } finally {
      savingSync.value = false
    }
  }

  async function runConfirmDialog() {
    if (!confirmDialogAction.value || confirmDialogLoading.value) {
      return
    }

    confirmDialogError.value = ''
    let ok = false
    switch (confirmDialogAction.value) {
      case 'clear_local':
        ok = await executeClearLocalMemory()
        break
      case 'clear_recall_adaptation':
        ok = await executeClearLocalRecallAdaptation()
        break
      case 'delete_cloud':
        ok = await executeDeleteCloudMemory()
        break
      case 'clear_orphans':
        ok = await executeClearOrphans()
        break
      case 'privacy_sync':
        ok = await executePrivacySyncEnable()
        break
      case 'restore_backup':
        ok = await executeRestoreLatestSyncBackup()
        break
      case 'delete_third_party':
        ok = await executeDeleteThirdPartyCorpus()
        break
      default:
        break
    }

    if (ok) {
      closeConfirmDialog()
    }
  }

  /** 确认框：按来源硬删第三方导入（含 0 条失败态清导入记录）。 */
  async function executeDeleteThirdPartyCorpus(): Promise<boolean> {
    const source = pendingThirdPartyDeleteSource.value
    const mode = pendingThirdPartyDeleteMode.value
    if (!source || mode == null) {
      return false
    }
    thirdPartyDeleteWorking.value = true
    try {
      const response = await deleteThirdPartyCorpusBySource({ source })
      if (!response.ok) {
        confirmDialogError.value = t('error_third_party_import_failed')
        return false
      }
      if (mode === 'record') {
        showToastSuccess(t('settings_third_party_clear_record_done'))
      } else {
        showToastSuccess(t('settings_third_party_delete_done', [String(response.deletedCount)]))
      }
      await loadThirdPartyCorpusSummary()
      return true
    } catch {
      confirmDialogError.value = t('error_third_party_import_failed')
      return false
    } finally {
      thirdPartyDeleteWorking.value = false
    }
  }

  /** 打开按来源删除确认框（有条目或仅有导入记录均可）。 */
  function handleDeleteThirdPartyCorpus(source: ThirdPartyCorpusSource): void {
    const mode = resolveThirdPartyDeleteMode({
      summary: thirdPartyCorpusSummary.value,
      source
    })
    if (mode === 'none' || thirdPartyDeleteWorking.value || thirdPartyImportWorking.value) {
      return
    }
    pendingThirdPartyDeleteSource.value = source
    pendingThirdPartyDeleteMode.value = mode
    confirmDialogError.value = ''
    confirmDialogAction.value = 'delete_third_party'
  }

  async function handleExportLocalMemory() {
    if (exportWorking.value || dataWorking.value || restoreWorking.value) {
      return
    }
    exportWorking.value = true
    try {
      const response = await exportLocalMemory()
      if (!response.ok) {
        showToastError(tAccountSyncError(response.errorCode))
        return
      }
      downloadLocalMemoryExportJson(
        response.ownerId,
        response.items,
        response.memoryNotes,
        response.memoryNotesMeta
      )
      showToastSuccess(t('settings_privacy_export_done', [String(response.items.length)]))
    } catch {
      showToastError(t('settings_error_local_export'))
    } finally {
      exportWorking.value = false
    }
  }

  /** 触发 Raindrop 导出文件选择。 */
  function handlePickRaindropImportFile(): void {
    if (
      thirdPartyImportWorking.value ||
      dataWorking.value ||
      exportWorking.value ||
      restoreWorking.value
    ) {
      return
    }
    raindropFileInputRef.value?.click()
  }

  /** 触发 Pocket 导出文件选择。 */
  function handlePickPocketImportFile(): void {
    if (
      thirdPartyImportWorking.value ||
      dataWorking.value ||
      exportWorking.value ||
      restoreWorking.value
    ) {
      return
    }
    pocketFileInputRef.value?.click()
  }

  /** 触发本地 Backup 恢复文件选择。 */
  function handlePickRestoreBackupFile(): void {
    if (
      restoreWorking.value ||
      thirdPartyImportWorking.value ||
      dataWorking.value ||
      exportWorking.value
    ) {
      return
    }
    restoreFileInputRef.value?.click()
  }

  /** 读取所选 Backup JSON 并恢复（merge/upsert）。 */
  async function handleRestoreBackupFileSelected(event: Event): Promise<void> {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) {
      return
    }
    const file = input.files?.[0]
    input.value = ''
    if (!file || restoreWorking.value) {
      return
    }
    restoreWorking.value = true
    try {
      const content = await file.text()
      const response = await importLocalMemory({ content })
      if (!response.ok) {
        showToastError(tLocalMemoryImportError(response.errorCode))
        return
      }
      const skipped = response.skippedItems + response.skippedNotes
      showToastSuccess(
        t('settings_privacy_restore_done', [
          String(response.restoredItems),
          String(response.restoredNotes),
          String(skipped)
        ])
      )
    } catch {
      showToastError(t('error_local_import_failed'))
    } finally {
      restoreWorking.value = false
    }
  }

  /** 读取所选文件并导入为第三方语料（§5.10.6）。 */
  async function runThirdPartyCorpusImport(
    source: 'raindrop' | 'pocket',
    file: File | undefined
  ): Promise<void> {
    if (!file || thirdPartyImportWorking.value || restoreWorking.value) {
      return
    }
    thirdPartyImportWorking.value = true
    try {
      const content = await file.text()
      const response = await importThirdPartyCorpus({ source, content })
      if (!response.ok) {
        showToastError(tThirdPartyImportError(response.errorCode))
        await loadThirdPartyCorpusSummary()
        return
      }
      showToastSuccess(
        t('settings_data_third_party_import_done', [
          String(response.importedCount),
          source === 'raindrop' ? 'Raindrop' : 'Pocket'
        ])
      )
      await loadThirdPartyCorpusSummary()
    } catch {
      showToastError(t('error_third_party_import_failed'))
      await loadThirdPartyCorpusSummary()
    } finally {
      thirdPartyImportWorking.value = false
    }
  }

  async function handleRaindropFileSelected(event: Event): Promise<void> {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) {
      return
    }
    const file = input.files?.[0]
    input.value = ''
    await runThirdPartyCorpusImport('raindrop', file)
  }

  async function handlePocketFileSelected(event: Event): Promise<void> {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) {
      return
    }
    const file = input.files?.[0]
    input.value = ''
    await runThirdPartyCorpusImport('pocket', file)
  }

  /** 清除本机记忆（不动 Chrome 原生书签）。 */
  function handleClearLocalMemory() {
    if (
      dataWorking.value ||
      exportWorking.value ||
      thirdPartyImportWorking.value ||
      restoreWorking.value ||
      signingOut.value
    ) {
      return
    }
    confirmDialogError.value = ''
    confirmDialogAction.value = 'clear_local'
  }

  /** 仅清除本机 Recall 适应信号（Outcome 对 + TTE 环）。 */
  function handleClearLocalRecallAdaptation() {
    if (
      dataWorking.value ||
      exportWorking.value ||
      thirdPartyImportWorking.value ||
      restoreWorking.value ||
      signingOut.value
    ) {
      return
    }
    confirmDialogError.value = ''
    confirmDialogAction.value = 'clear_recall_adaptation'
  }

  async function executeClearLocalMemory(): Promise<boolean> {
    dataWorking.value = true
    try {
      const response = await clearLocalMemory()
      if (!response.ok) {
        confirmDialogError.value = tAccountSyncError(response.errorCode)
        return false
      }
      chromeBookmarkIngestEnabled.value = false
      chromeBookmarkSyncEnabled.value = false
      if (response.syncDisabled) {
        syncEnabled.value = false
        showToastSuccess(
          t('settings_data_clear_local_done_sync_off', [String(response.clearedCount)])
        )
      } else {
        showToastSuccess(t('settings_data_clear_local_done', [String(response.clearedCount)]))
      }
      await refreshSyncStatus()
      return true
    } catch {
      confirmDialogError.value = t('settings_error_local_clear')
      return false
    } finally {
      dataWorking.value = false
    }
  }

  async function executeClearLocalRecallAdaptation(): Promise<boolean> {
    dataWorking.value = true
    try {
      const response = await clearLocalRecallAdaptation()
      if (!response.ok) {
        confirmDialogError.value = tAccountSyncError(response.errorCode)
        return false
      }
      showToastSuccess(t('settings_data_clear_recall_adaptation_done'))
      return true
    } catch {
      confirmDialogError.value = t('settings_error_local_recall_adaptation_clear')
      return false
    } finally {
      dataWorking.value = false
    }
  }

  /** 立即跑一轮增量同步（不整侧 replace）。 */
  async function handleRunIncrementalSync() {
    if (!signedIn.value || !syncEnabled.value || runningIncrementalSync.value) {
      return
    }
    runningIncrementalSync.value = true
    try {
      const response = await runIncrementalMemorySync()
      if (!response.ok) {
        showToastError(
          response.error
            ? `${tAccountSyncError(response.errorCode)}（${response.error}）`
            : tAccountSyncError(response.errorCode)
        )
        return
      }
      showToastSuccess(
        t('settings_sync_now_done', [String(response.pulled), String(response.pushed)])
      )
      await refreshSyncStatus()
    } catch {
      showToastError(
        readBrowserOnline()
          ? t('settings_error_sync_incremental')
          : t('settings_error_sync_incremental_offline')
      )
    } finally {
      runningIncrementalSync.value = false
    }
  }

  /** 用云端最近一次 replace 前备份救回，并拉回本机。 */
  function handleRestoreLatestSyncBackup() {
    if (!signedIn.value || restoringSyncBackup.value) {
      return
    }
    confirmDialogError.value = ''
    confirmDialogAction.value = 'restore_backup'
  }

  async function executeRestoreLatestSyncBackup(): Promise<boolean> {
    restoringSyncBackup.value = true
    try {
      const response = await restoreLatestSyncBackup()
      if (!response.ok) {
        confirmDialogError.value = response.error
          ? `${tAccountSyncError(response.errorCode)}（${response.error}）`
          : tAccountSyncError(response.errorCode)
        return false
      }
      showToastSuccess(t('settings_sync_restore_backup_done', [String(response.restored)]))
      await refreshSyncStatus()
      return true
    } catch {
      confirmDialogError.value = t('settings_error_sync_restore_backup')
      return false
    } finally {
      restoringSyncBackup.value = false
    }
  }

  async function refreshWebsiteAuthMismatch(): Promise<void> {
    try {
      const ui = await readWebsiteAuthUiState()
      if (ui?.signedIn && ui.userId?.trim()) {
        websiteAuthUserId.value = ui.userId.trim()
      } else {
        websiteAuthUserId.value = null
      }
    } catch {
      websiteAuthUserId.value = null
    }
  }

  async function openSignOutDialog() {
    signOutError.value = ''
    signOutFlushFailed.value = false
    signOutDeleteLocalExcerpts.value = false
    if (!signedIn.value) {
      return
    }
    await loadSyncContext()
    // 本机无数 → 直接 keep_local 退出
    if (signOutLocalCount.value === 0) {
      await confirmSignOut('keep_local')
      return
    }
    signOutDialogOpen.value = true
  }

  function closeSignOutDialog() {
    if (signingOut.value) {
      return
    }
    signOutDialogOpen.value = false
    signOutError.value = ''
    signOutFlushFailed.value = false
    signOutDeleteLocalExcerpts.value = false
  }

  async function confirmSignOut(mode: AuthSignOutMode) {
    if (signingOut.value) {
      return
    }
    if (mode === 'flush_then_keep' && !showSignOutFlushAction.value) {
      return
    }
    if (mode === 'clear_local' && !showSignOutClearAction.value) {
      return
    }

    signingOut.value = true
    signOutError.value = ''
    signOutFlushFailed.value = false
    try {
      const response = await authSignOut(mode, {
        deleteLocalExcerpts: signOutDeleteLocalExcerpts.value
      })
      if (!response.ok) {
        if (mode === 'flush_then_keep' && response.flushFailed) {
          signOutError.value = t('settings_sign_out_flush_failed_keep_anyway')
          signOutFlushFailed.value = true
        } else {
          signOutError.value = tAccountSyncError(response.errorCode)
        }
        return
      }
      signOutDialogOpen.value = false
      signOutFlushFailed.value = false
      signedIn.value = false
      accountEmail.value = ''
      accountDisplayName.value = ''
      accountId.value = null
      syncEnabled.value = false
      syncLocalCount.value = 0
      syncAccountOwnerCount.value = 0
      syncLocalProfileOwnerCount.value = 0
      syncRemoteCount.value = 0
      // 退出后以服务端/本机最新同步状态为准（覆盖上方置 0）
      await refreshSyncStatus()
    } catch {
      signOutError.value = t('settings_error_auth_sign_out')
    } finally {
      signingOut.value = false
    }
  }

  /** flush 失败后：先导出本机备份（不退出）。 */
  async function exportBeforeSignOutAfterFlushFail(): Promise<void> {
    await handleExportLocalMemory()
  }

  /** flush 失败后：用户确认仍退出 → keep_local（资料回迁保留）。 */
  async function confirmSignOutAnywayAfterFlushFail(): Promise<void> {
    signOutFlushFailed.value = false
    await confirmSignOut('keep_local')
  }

  /** 取消登录态 / 官网 UI 桥 storage 订阅。 */
  let stopWatchAuthSession: (() => void) | null = null
  let stopWatchWebsiteAuthUi: (() => void) | null = null

  /**
   * 深链 hash（如空库「同步书签」→ `#chrome-bookmark-sync`）：
   * 切到保存分区并滚到目标开关。
   */
  function scrollToSettingsHashTarget(): void {
    const raw = window.location.hash.replace(/^#/, '').trim()
    if (!raw) {
      return
    }
    if (
      (raw === SETTINGS_HASH_CHROME_BOOKMARK_SYNC || raw === SETTINGS_HASH_BEHAVIOR_IMPORT) &&
      activeSection.value !== 'capture'
    ) {
      activeSection.value = DEFAULT_SETTINGS_SECTION
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(raw)
      if (!el) {
        return
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  function handleHashChange(): void {
    scrollToSettingsHashTarget()
  }

  onMounted(() => {
    void loadCommands()
    void loadUserSettings()
    void loadSyncContext()
    // 官网 handoff / 扩展内登出：立即刷新 signedIn、同步与配额，不依赖切回前台
    stopWatchAuthSession = watchAuthSessionStorage(() => {
      void loadSyncContext()
    })
    stopWatchWebsiteAuthUi = watchWebsiteAuthUiStorage(() => {
      void refreshWebsiteAuthMismatch()
    })
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handleHashChange)
    document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
    // 首屏：等面板挂上再滚（capture 默认已选）
    void nextTick().then(() => {
      scrollToSettingsHashTarget()
    })
  })

  onUnmounted(() => {
    stopWatchAuthSession?.()
    stopWatchAuthSession = null
    stopWatchWebsiteAuthUi?.()
    stopWatchWebsiteAuthUi = null
    stopBookmarkImportPolling()
    stopBehaviorImportPolling()
    if (behaviorClearDoneTimer !== null) {
      clearTimeout(behaviorClearDoneTimer)
      behaviorClearDoneTimer = null
    }
    window.removeEventListener('popstate', handlePopState)
    window.removeEventListener('hashchange', handleHashChange)
    document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  })

  return {
    accountDisplayName,
    accountEmail,
    websiteAccountMismatch,
    activeSection,
    activeSectionLabel,
    activeSectionTab,
    aiFeaturesEnabled,
    awaitingShortcutsReturn,
    chromeBookmarkIngestEnabled,
    chromeBookmarkImportStatusCopy,
    chromeBookmarkImportStatusKind,
    chromeBookmarkSyncEnabled,
    linkStatusSweepEnabled,
    closeConfirmDialog,
    closeDeleteAccountDialog,
    closeSignOutDialog,
    confirmSignOutAnywayAfterFlushFail,
    exportBeforeSignOutAfterFlushFail,
    commandRows,
    commands,
    commandsError,
    commandsState,
    confirmDeleteAccount,
    confirmDialogAction,
    confirmDialogBody,
    confirmDialogBodyLinkHref,
    confirmDialogBodyLinkLabel,
    confirmDialogError,
    confirmDialogLoading,
    confirmDialogOpen,
    confirmDialogTitle,
    confirmDialogTone,
    confirmSignOut,
    dataError,
    dataWorking,
    deleteAccountDialogOpen,
    downloadLocalMemoryExportJson,
    downloadOrphanExportJson,
    executeClearLocalMemory,
    executeClearLocalRecallAdaptation,
    executeClearOrphans,
    executeDeleteCloudMemory,
    executePrivacySyncEnable,
    executeRestoreLatestSyncBackup,
    exportWorking,
    restoreWorking,
    handleAiFeaturesToggle,
    handleLinkStatusSweepToggle,
    handleChromeBookmarkSyncToggle,
    handleReimportChromeBookmarks,
    handleImportBehaviorHistory,
    handleClearBehaviorHistory,
    handleClearLocalMemory,
    handleClearLocalRecallAdaptation,
    handleClearOrphans,
    handleDeleteThirdPartyCorpus,
    handleRecallOutcomePairSoftAdjustToggle,
    handleDeleteCloudMemory,
    handleDocumentVisibilityChange,
    handleExportLocalMemory,
    handleExportOrphans,
    handleMcpReadOnlyToggle,
    handleDualThreadLocalLearningToggle,
    handleDualThreadContributeToggle,
    handleDeleteDualThreadContributedSketches,
    handleOpenShortcutsPage,
    handlePickPocketImportFile,
    handlePickRaindropImportFile,
    handlePickRestoreBackupFile,
    handlePocketFileSelected,
    handleRestoreBackupFileSelected,
    handlePopState,
    handleRaindropFileSelected,
    handleRestoreLatestSyncBackup,
    handleRunIncrementalSync,
    handleSelectionToolbarToggle,
    handleRetryAnonymousCaptcha,
    handleSignIn,
    handleSyncToggle,
    handleUiLocalePreferenceChange,
    hasCompletedInitialSectionSync,
    hasOrphanOwners,
    bindOtpModalOpen,
    openBindOtpModal,
    closeBindOtpModal,
    handleBindOtpSuccess,
    hostedQuotaError,
    hostedQuotaLoading,
    hostedQuotaText,
    isAnonymous,
    loadCommands,
    loadHostedQuota,
    trialEmbedLimit,
    trialEmbedRemaining,
    trialLlmLimit,
    trialLlmRemaining,
    loadSubscriptionStatus,
    loadSyncContext,
    loadThirdPartyCorpusSummary,
    loadUserSettings,
    mcpReadOnlyEnabled,
    recallOutcomePairSoftAdjustEnabled,
    dualThreadLocalLearningEnabled,
    dualThreadContributeAggregatesEnabled,
    dualThreadLearningSketch,
    dualThreadLearningLoading,
    dualThreadLearningError,
    dualThreadDeleteWorking,
    dualThreadDeleteError,
    dualThreadContributeDisabled,
    dualThreadContributeGateText,
    dualThreadLastContributionText,
    dualThreadLearningHasAttributions,
    openDeleteAccountDialog,
    openShortcutsError,
    openSignOutDialog,
    openingShortcuts,
    orphanActiveCount,
    orphanBucketCount,
    orphanWorking,
    pendingSyncEnable,
    pendingThirdPartyDeleteSource,
    pocketFileInputRef,
    privacyNoticeAcked,
    faqUrl,
    pricingUrl,
    privacyPolicyUrl,
    raindropFileInputRef,
    supportUrl,
    restoreFileInputRef,
    refreshCommandsIfReturnedFromShortcuts,
    refreshSyncContextOnVisible,
    refreshSyncStatus,
    restoringSyncBackup,
    runConfirmDialog,
    runThirdPartyCorpusImport,
    runningIncrementalSync,
    savingAiFeatures,
    savingLinkStatusSweep,
    savingChromeBookmarkSync,
    reimportChromeBookmarksBusy,
    reimportChromeBookmarksDone,
    reimportChromeBookmarksDoneText,
    behaviorImportBusy,
    behaviorClearBusy,
    behaviorClearDone,
    behaviorImportStatusCopy,
    savingMcpReadOnly,
    savingRecallOutcomeSoftAdjust,
    savingDualThreadLocalLearning,
    savingDualThreadContribute,
    savingSelectionToolbar,
    savingSync,
    savingUiLocale,
    selectionToolbarEnabled,
    uiLocalePreference,
    settingsActiveTabId,
    settingsError,
    settingsPanelId,
    settingsSectionTabItems,
    settingsSectionTabsId,
    settingsState,
    dismissDeleteAfterExport,
    dismissLoginMigration,
    loginMigrationBookmarkCount,
    loginMigrationDeleteAfterExportOpen,
    loginMigrationError,
    loginMigrationExcerptCount,
    loginMigrationLoading,
    loginMigrationOpen,
    runLoginMigrationDelete,
    runLoginMigrationExport,
    runLoginMigrationImport,
    showSignOutClearAction,
    showSignOutFlushAction,
    signOutDeleteLocalExcerpts,
    signOutDialogOpen,
    signOutError,
    signOutFlushFailed,
    signOutLocalCount,
    showAnonymousCaptchaRetry,
    retryingAnonymousCaptcha,
    signedIn,
    signingIn,
    signingOut,
    subscriptionIsPro,
    syncAccountOwnerCount,
    syncActiveSectionToUrl,
    syncEnabled,
    syncLastPulledAt,
    syncLocalCount,
    syncLocalProfileOwnerCount,
    syncRemoteCount,
    termsOfServiceUrl,
    thirdPartyCorpusSummary,
    thirdPartyDeleteMode,
    thirdPartyDeleteWorking,
    thirdPartyImportWorking,
    thirdPartySourceStatusCopy,
    thirdPartySummaryLoading,
    t
  }
}

export type SettingsPageController = ReturnType<typeof useSettingsPage>
