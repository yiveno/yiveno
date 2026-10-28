import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import {
  formatExtensionCommandShortcut,
  getExtensionCommandDisplayTitle
} from '@/core/commands/command-display'
import type { ExtensionCommandInfo } from '@/core/messaging/commands-messages'
import type { AuthSignOutMode } from '@/core/messaging/account-sync-messages'
import type { UiLocalePreference } from '@/core/i18n/ui-locale'
import {
  DEFAULT_SETTINGS_SECTION,
  parseSettingsSectionFromLocationSearch,
  resolveSettingsSectionTab,
  SETTINGS_HASH_CHROME_BOOKMARK_INGEST,
  SETTINGS_SECTION_TABS,
  type SettingsSectionId
} from '@/core/settings/settings-sections'
import {
  ackPrivacyNotice,
  authSignOut,
  clearLocalMemory,
  clearOrphanOwners,
  deleteAccount,
  deleteCloudMemory,
  exportLocalMemory,
  exportOrphanOwners,
  fetchAuthState,
  fetchExtensionCommands,
  fetchSubscriptionStatus,
  fetchSyncStatus,
  fetchUserSettings,
  openChromeShortcutsPage,
  fetchAiHostedQuota,
  restoreLatestSyncBackup,
  setSyncEnabled,
  setMcpReadOnly,
  runIncrementalMemorySync,
  updateUserSettings,
  importThirdPartyCorpus
} from '@/infrastructure/messaging/background-client'
import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'
import { useLoginMigrationDialog } from '@/pages/shared/use-login-migration-dialog'
import {
  tAccountSyncError,
  tCommandsError,
  tSettingsError,
  tThirdPartyImportError
} from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
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
  const chromeBookmarkIngestEnabled = ref(false)
  const aiFeaturesEnabled = ref(true)
  const mcpReadOnlyEnabled = ref(false)
  const uiLocalePreference = ref<UiLocalePreference>('system')
  const settingsState = ref<SettingsLoadState>('loading')
  const settingsError = ref('')
  const savingSelectionToolbar = ref(false)
  const savingChromeBookmarkIngest = ref(false)
  const savingAiFeatures = ref(false)
  const savingMcpReadOnly = ref(false)
  const savingUiLocale = ref(false)
  const hostedQuotaLoading = ref(false)
  const hostedQuotaText = ref('')
  const hostedQuotaError = ref('')

  const signedIn = ref(false)
  const accountEmail = ref('')
  const accountDisplayName = ref('')
  const subscriptionIsPro = ref(false)
  const subscriptionTierLabel = ref('')
  const subscriptionPeriodEnd = ref<string | null>(null)
  const subscriptionUpgradeUrl = ref<string | null>(null)
  const subscriptionManageUrl = ref<string | null>(null)
  const subscriptionError = ref('')

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
  const raindropFileInputRef = ref<HTMLInputElement | null>(null)
  const pocketFileInputRef = ref<HTMLInputElement | null>(null)

  /** 官网隐私政策 / 服务条款全文 URL。 */
  const privacyPolicyUrl = `${getWebsiteBaseUrl()}/privacy`
  const termsOfServiceUrl = `${getWebsiteBaseUrl()}/terms`

  const signOutDialogOpen = ref(false)
  const deleteAccountDialogOpen = ref(false)
  /** 通用危险/确认弹窗（替代 window.confirm） */
  type SettingsConfirmAction =
    'clear_local' | 'delete_cloud' | 'clear_orphans' | 'privacy_sync' | 'restore_backup'

  const confirmDialogAction = ref<SettingsConfirmAction | null>(null)
  const confirmDialogError = ref('')
  /** privacy_sync 确认后继续执行的开关目标值 */
  const pendingSyncEnable = ref<boolean | null>(null)
  const signingOut = ref(false)
  const signOutError = ref('')

  const {
    dismissDeleteAfterExport,
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
      syncActiveSectionToUrl(section)
      hasCompletedInitialSectionSync.value = true
      if (section === 'ai') {
        void loadHostedQuota()
      }
    },
    { immediate: true }
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
      aiFeaturesEnabled.value = response.settings.aiFeaturesEnabled
      mcpReadOnlyEnabled.value = response.settings.mcpReadOnlyEnabled
      uiLocalePreference.value = response.settings.uiLocalePreference
      settingsState.value = 'ready'
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

  /** Chrome 书签灌库开关（bulk + 增量）。 */
  async function handleChromeBookmarkIngestToggle(nextValue: boolean) {
    savingChromeBookmarkIngest.value = true
    settingsError.value = ''

    try {
      const response = await updateUserSettings({ chromeBookmarkIngestEnabled: nextValue })
      if (!response.ok) {
        settingsError.value = tSettingsError(response.errorCode)
        return
      }

      chromeBookmarkIngestEnabled.value = response.settings.chromeBookmarkIngestEnabled
    } catch {
      settingsError.value = t('settings_error_update')
    } finally {
      savingChromeBookmarkIngest.value = false
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

  /** 刷新托管 Clue LLM 配额展示。 */
  async function loadHostedQuota(): Promise<void> {
    hostedQuotaError.value = ''
    hostedQuotaText.value = ''
    if (!signedIn.value) {
      hostedQuotaText.value = t('settings_ai_quota_sign_in')
      return
    }
    hostedQuotaLoading.value = true
    try {
      const response = await fetchAiHostedQuota()
      if (!response.ok) {
        hostedQuotaError.value = tSettingsError(response.errorCode)
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
      hostedQuotaError.value = t('settings_ai_quota_failed')
    } finally {
      hostedQuotaLoading.value = false
    }
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

      signedIn.value = response.signedIn
      accountEmail.value = response.email?.trim() ?? ''
      accountDisplayName.value = response.displayName?.trim() ?? ''
      syncEnabled.value = response.syncPrefs.enabled

      // 未登录也要盘点孤儿桶（换号退出后残留仍可见）
      await refreshSyncStatus()
      await loadSubscriptionStatus()
      if (response.signedIn) {
        await refreshLoginMigrationGate()
      }
      if (activeSection.value === 'ai') {
        await loadHostedQuota()
      }
    } catch {
      showToastError(t('settings_error_auth_state'))
    }
  }

  /** 加载订阅快照（Pro / Free + 升级/管理链接）。 */
  async function loadSubscriptionStatus(forceRefresh = false): Promise<void> {
    subscriptionError.value = ''
    try {
      const response = await fetchSubscriptionStatus(forceRefresh ? { refresh: true } : undefined)
      if (!response.ok) {
        subscriptionError.value = tAccountSyncError(response.errorCode)
        return
      }
      subscriptionIsPro.value = response.snapshot.isPro
      subscriptionTierLabel.value = response.snapshot.isPro
        ? t('settings_subscription_tier_pro')
        : t('settings_subscription_tier_free')
      subscriptionPeriodEnd.value = response.snapshot.currentPeriodEnd
      subscriptionUpgradeUrl.value = response.upgradeUrl
      subscriptionManageUrl.value = response.manageUrl
    } catch {
      subscriptionError.value = t('settings_error_subscription_status')
    }
  }

  function openExternalUrl(url: string | null): void {
    if (!url) {
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
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

  /** 下载当前 owner 本机记忆 JSON。 */
  function downloadLocalMemoryExportJson(ownerId: string, items: unknown[]): void {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            ownerId,
            items
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

  /** Plan 行标题：档位 + 续费/到期日 */
  const subscriptionPlanRowTitle = computed(() => {
    if (!signedIn.value) {
      return ''
    }
    const parts = [subscriptionTierLabel.value]
    if (subscriptionPeriodEnd.value) {
      parts.push(
        t('settings_subscription_period_end', [
          new Date(subscriptionPeriodEnd.value).toLocaleDateString()
        ])
      )
    }
    return parts.join(' · ')
  })

  const confirmDialogOpen = computed(() => confirmDialogAction.value !== null)

  const confirmDialogTitle = computed(() => {
    switch (confirmDialogAction.value) {
      case 'clear_local':
        return t('settings_data_clear_local')
      case 'delete_cloud':
        return t('settings_privacy_delete_cloud')
      case 'clear_orphans':
        return t('settings_orphan_clear')
      case 'privacy_sync':
        return t('settings_sync_toggle')
      case 'restore_backup':
        return t('settings_sync_restore_backup')
      default:
        return ''
    }
  })

  const confirmDialogBody = computed(() => {
    switch (confirmDialogAction.value) {
      case 'clear_local':
        return t('settings_data_clear_local_confirm')
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
      default:
        return ''
    }
  })

  const confirmDialogTone = computed<'default' | 'danger'>(() => {
    const action = confirmDialogAction.value
    return action === 'clear_local' || action === 'delete_cloud' || action === 'clear_orphans'
      ? 'danger'
      : 'default'
  })

  const confirmDialogLoading = computed(() => {
    switch (confirmDialogAction.value) {
      case 'clear_local':
      case 'delete_cloud':
        return dataWorking.value
      case 'clear_orphans':
        return orphanWorking.value
      case 'privacy_sync':
        return savingSync.value
      case 'restore_backup':
        return restoringSyncBackup.value
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
      default:
        break
    }

    if (ok) {
      closeConfirmDialog()
    }
  }

  async function handleExportLocalMemory() {
    if (exportWorking.value || dataWorking.value) {
      return
    }
    exportWorking.value = true
    try {
      const response = await exportLocalMemory()
      if (!response.ok) {
        showToastError(tAccountSyncError(response.errorCode))
        return
      }
      downloadLocalMemoryExportJson(response.ownerId, response.items)
      showToastSuccess(t('settings_privacy_export_done', [String(response.items.length)]))
    } catch {
      showToastError(t('settings_error_local_export'))
    } finally {
      exportWorking.value = false
    }
  }

  /** 触发 Raindrop 导出文件选择。 */
  function handlePickRaindropImportFile(): void {
    if (thirdPartyImportWorking.value || dataWorking.value || exportWorking.value) {
      return
    }
    raindropFileInputRef.value?.click()
  }

  /** 触发 Pocket 导出文件选择。 */
  function handlePickPocketImportFile(): void {
    if (thirdPartyImportWorking.value || dataWorking.value || exportWorking.value) {
      return
    }
    pocketFileInputRef.value?.click()
  }

  /** 读取所选文件并导入为第三方语料（§5.10.6）。 */
  async function runThirdPartyCorpusImport(
    source: 'raindrop' | 'pocket',
    file: File | undefined
  ): Promise<void> {
    if (!file || thirdPartyImportWorking.value) {
      return
    }
    thirdPartyImportWorking.value = true
    try {
      const content = await file.text()
      const response = await importThirdPartyCorpus({ source, content })
      if (!response.ok) {
        showToastError(tThirdPartyImportError(response.errorCode))
        return
      }
      showToastSuccess(
        t('settings_data_third_party_import_done', [
          String(response.importedCount),
          source === 'raindrop' ? 'Raindrop' : 'Pocket'
        ])
      )
    } catch {
      showToastError(t('error_third_party_import_failed'))
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
      signingOut.value
    ) {
      return
    }
    confirmDialogError.value = ''
    confirmDialogAction.value = 'clear_local'
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
      showToastError(t('settings_error_sync_incremental'))
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

  async function openSignOutDialog() {
    signOutError.value = ''
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
    try {
      const response = await authSignOut(mode)
      if (!response.ok) {
        if (mode === 'flush_then_keep') {
          signOutError.value = `${tAccountSyncError(response.errorCode)} ${t('settings_sign_out_flush_failed_keep_anyway')}`
        } else {
          signOutError.value = tAccountSyncError(response.errorCode)
        }
        return
      }
      signOutDialogOpen.value = false
      signedIn.value = false
      accountEmail.value = ''
      syncEnabled.value = false
      syncLocalCount.value = 0
      syncAccountOwnerCount.value = 0
      syncLocalProfileOwnerCount.value = 0
      syncRemoteCount.value = 0
    } catch {
      signOutError.value = t('settings_error_auth_sign_out')
    } finally {
      signingOut.value = false
    }
  }

  /** 取消登录态 storage 订阅。 */
  let stopWatchAuthSession: (() => void) | null = null

  /**
   * 深链 hash（如空库「导入」→ `#chrome-bookmark-ingest`）：
   * 切到保存分区并滚到目标开关。
   */
  function scrollToSettingsHashTarget(): void {
    const raw = window.location.hash.replace(/^#/, '').trim()
    if (!raw) {
      return
    }
    if (raw === SETTINGS_HASH_CHROME_BOOKMARK_INGEST && activeSection.value !== 'capture') {
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
    window.removeEventListener('popstate', handlePopState)
    window.removeEventListener('hashchange', handleHashChange)
    document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  })

  return {
    accountDisplayName,
    accountEmail,
    activeSection,
    activeSectionLabel,
    activeSectionTab,
    aiFeaturesEnabled,
    awaitingShortcutsReturn,
    chromeBookmarkIngestEnabled,
    closeConfirmDialog,
    closeDeleteAccountDialog,
    closeSignOutDialog,
    commandRows,
    commands,
    commandsError,
    commandsState,
    confirmDeleteAccount,
    confirmDialogAction,
    confirmDialogBody,
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
    executeClearOrphans,
    executeDeleteCloudMemory,
    executePrivacySyncEnable,
    executeRestoreLatestSyncBackup,
    exportWorking,
    handleAiFeaturesToggle,
    handleChromeBookmarkIngestToggle,
    handleClearLocalMemory,
    handleClearOrphans,
    handleDeleteCloudMemory,
    handleDocumentVisibilityChange,
    handleExportLocalMemory,
    handleExportOrphans,
    handleMcpReadOnlyToggle,
    handleOpenShortcutsPage,
    handlePickPocketImportFile,
    handlePickRaindropImportFile,
    handlePocketFileSelected,
    handlePopState,
    handleRaindropFileSelected,
    handleRestoreLatestSyncBackup,
    handleRunIncrementalSync,
    handleSelectionToolbarToggle,
    handleSyncToggle,
    handleUiLocalePreferenceChange,
    hasCompletedInitialSectionSync,
    hasOrphanOwners,
    hostedQuotaError,
    hostedQuotaLoading,
    hostedQuotaText,
    loadCommands,
    loadHostedQuota,
    loadSubscriptionStatus,
    loadSyncContext,
    loadUserSettings,
    mcpReadOnlyEnabled,
    openDeleteAccountDialog,
    openExternalUrl,
    openShortcutsError,
    openSignOutDialog,
    openingShortcuts,
    orphanActiveCount,
    orphanBucketCount,
    orphanWorking,
    pendingSyncEnable,
    pocketFileInputRef,
    privacyNoticeAcked,
    privacyPolicyUrl,
    raindropFileInputRef,
    refreshCommandsIfReturnedFromShortcuts,
    refreshSyncContextOnVisible,
    refreshSyncStatus,
    restoringSyncBackup,
    runConfirmDialog,
    runThirdPartyCorpusImport,
    runningIncrementalSync,
    savingAiFeatures,
    savingChromeBookmarkIngest,
    savingMcpReadOnly,
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
    signOutDialogOpen,
    signOutError,
    signOutLocalCount,
    signedIn,
    signingOut,
    subscriptionError,
    subscriptionIsPro,
    subscriptionManageUrl,
    subscriptionPeriodEnd,
    subscriptionPlanRowTitle,
    subscriptionTierLabel,
    subscriptionUpgradeUrl,
    syncAccountOwnerCount,
    syncActiveSectionToUrl,
    syncEnabled,
    syncLastPulledAt,
    syncLocalCount,
    syncLocalProfileOwnerCount,
    syncRemoteCount,
    termsOfServiceUrl,
    thirdPartyImportWorking,
    t
  }
}

export type SettingsPageController = ReturnType<typeof useSettingsPage>
