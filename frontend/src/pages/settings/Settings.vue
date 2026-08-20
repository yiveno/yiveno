<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import {
  formatExtensionCommandShortcut,
  getExtensionCommandDisplayTitle
} from '@/core/commands/command-display'
import type { ExtensionCommandInfo } from '@/core/messaging/commands-messages'
import type { AuthSignOutMode } from '@/core/messaging/account-sync-messages'
import {
  buildSettingsSectionLocationSearch,
  parseSettingsSectionFromLocationSearch,
  resolveSettingsSectionTab,
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
  backfillMemoryEmbeddings,
  fetchAiHostedQuota,
  restoreLatestSyncBackup,
  setSyncEnabled,
  runIncrementalMemorySync,
  updateUserSettings
} from '@/infrastructure/messaging/background-client'
import {
  tAccountSyncError,
  tCommandsError,
  tSettingsError
} from '@/infrastructure/i18n/background-error'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'
import { t } from '@/infrastructure/i18n/t'
import { getWebsiteBaseUrl } from '@/infrastructure/browser/website-page'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'
import { asMdSwitchElement } from '@/infrastructure/ui/register-material-web'

defineOptions({ name: 'SettingsPage' })

type LoadState = 'loading' | 'ready' | 'error'

/** 启动时从 URL 解析当前分区。 */
const activeSection = ref<SettingsSectionId>(
  parseSettingsSectionFromLocationSearch(window.location.search)
)

const commands = ref<ExtensionCommandInfo[]>([])
const commandsState = ref<LoadState>('loading')
const commandsError = ref('')
const openingShortcuts = ref(false)
const openShortcutsError = ref('')
/** 已打开原生快捷键页，待用户返回后静默刷新绑定。 */
const awaitingShortcutsReturn = ref(false)

const selectionToolbarEnabled = ref(true)
const chromeBookmarkIngestEnabled = ref(true)
const aiFeaturesEnabled = ref(true)
const settingsState = ref<LoadState>('loading')
const settingsError = ref('')
const savingSelectionToolbar = ref(false)
const savingChromeBookmarkIngest = ref(false)
const savingAiFeatures = ref(false)
const embeddingBackfillWorking = ref(false)
const embeddingBackfillMessage = ref('')
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
const orphanMessage = ref('')
const savingSync = ref(false)
const runningIncrementalSync = ref(false)
const restoringSyncBackup = ref(false)
const syncError = ref('')
const syncRestoreMessage = ref('')
const syncLastPulledAt = ref<string | null>(null)
const syncMessage = ref('')
const privacyNoticeAcked = ref(false)
const dataWorking = ref(false)
const dataError = ref('')
const dataMessage = ref('')
const exportWorking = ref(false)

/** 官网隐私政策 / 服务条款全文 URL。 */
const privacyPolicyUrl = `${getWebsiteBaseUrl()}/privacy`
const termsOfServiceUrl = `${getWebsiteBaseUrl()}/terms`

const signOutDialogOpen = ref(false)
const signingOut = ref(false)
const signOutError = ref('')

/** 退出相关：本机当前账号桶 + 未 remap 的本地档。 */
const signOutLocalCount = computed(
  () => syncAccountOwnerCount.value + syncLocalProfileOwnerCount.value
)

const hasOrphanOwners = computed(() => orphanBucketCount.value > 0)

/**
 * 方案 B：本机有数即弹窗并始终三按钮（含先同步再清），避免启发式误判。
 * 本机无数则不弹窗、直接仅退出。
 */
const showSignOutDataActions = computed(() => signOutLocalCount.value > 0)

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

/** 切换左侧分区。 */
function selectSection(section: SettingsSectionId) {
  if (activeSection.value === section) {
    return
  }
  activeSection.value = section
}

/** 将当前分区同步到 `?section=`（默认 usage 不写 query）。 */
function syncActiveSectionToUrl(section: SettingsSectionId) {
  const nextSearch = buildSettingsSectionLocationSearch(section, window.location.search)
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

watch(
  activeSection,
  section => {
    syncActiveSectionToUrl(section)
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
  if (document.visibilityState !== 'visible' || !awaitingShortcutsReturn.value) {
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
    settingsState.value = 'ready'
  } catch {
    settingsState.value = 'error'
    settingsError.value = t('settings_error_load')
  }
}

async function handleSelectionToolbarToggle(event: Event) {
  const switchEl = asMdSwitchElement(event.target)
  if (!switchEl) {
    return
  }

  const nextValue = switchEl.selected
  savingSelectionToolbar.value = true
  settingsError.value = ''

  try {
    const response = await updateUserSettings({ selectionToolbarEnabled: nextValue })
    if (!response.ok) {
      switchEl.selected = !nextValue
      settingsError.value = tSettingsError(response.errorCode)
      return
    }

    selectionToolbarEnabled.value = response.settings.selectionToolbarEnabled
  } catch {
    switchEl.selected = !nextValue
    settingsError.value = t('settings_error_update')
  } finally {
    savingSelectionToolbar.value = false
  }
}

/** Chrome 书签灌库开关（bulk + 增量）。 */
async function handleChromeBookmarkIngestToggle(event: Event) {
  const switchEl = asMdSwitchElement(event.target)
  if (!switchEl) {
    return
  }

  const nextValue = switchEl.selected
  savingChromeBookmarkIngest.value = true
  settingsError.value = ''

  try {
    const response = await updateUserSettings({ chromeBookmarkIngestEnabled: nextValue })
    if (!response.ok) {
      switchEl.selected = !nextValue
      settingsError.value = tSettingsError(response.errorCode)
      return
    }

    chromeBookmarkIngestEnabled.value = response.settings.chromeBookmarkIngestEnabled
  } catch {
    switchEl.selected = !nextValue
    settingsError.value = t('settings_error_update')
  } finally {
    savingChromeBookmarkIngest.value = false
  }
}

/** AI 功能开关（线索理解 + Capture enrichment）。 */
async function handleAiFeaturesToggle(event: Event) {
  const switchEl = asMdSwitchElement(event.target)
  if (!switchEl) {
    return
  }

  const nextValue = switchEl.selected
  savingAiFeatures.value = true
  settingsError.value = ''

  try {
    const response = await updateUserSettings({ aiFeaturesEnabled: nextValue })
    if (!response.ok) {
      switchEl.selected = !nextValue
      settingsError.value = tSettingsError(response.errorCode)
      return
    }

    aiFeaturesEnabled.value = response.settings.aiFeaturesEnabled
  } catch {
    switchEl.selected = !nextValue
    settingsError.value = t('settings_error_update')
  } finally {
    savingAiFeatures.value = false
  }
}

/** 将缺 embedding 的本机记忆入队回填（须登录）。 */
async function handleEmbeddingBackfill() {
  embeddingBackfillWorking.value = true
  embeddingBackfillMessage.value = ''
  settingsError.value = ''
  try {
    const response = await backfillMemoryEmbeddings()
    if (!response.ok) {
      settingsError.value = tMemoryError(response.errorCode)
      return
    }
    if (!('enqueued' in response)) {
      settingsError.value = t('settings_error_update')
      return
    }
    embeddingBackfillMessage.value = t('settings_embedding_backfill_done', [
      String(response.enqueued)
    ])
  } catch {
    settingsError.value = t('settings_error_update')
  } finally {
    embeddingBackfillWorking.value = false
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
  syncError.value = ''
  const response = await fetchSyncStatus()
  if (!response.ok) {
    syncError.value = tAccountSyncError(response.errorCode)
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
  syncError.value = ''
  orphanMessage.value = ''

  try {
    const response = await fetchAuthState()
    if (!response.ok) {
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }

    signedIn.value = response.signedIn
    accountEmail.value = response.email?.trim() ?? ''
    accountDisplayName.value = response.displayName?.trim() ?? ''
    syncEnabled.value = response.syncPrefs.enabled

    // 未登录也要盘点孤儿桶（换号退出后残留仍可见）
    await refreshSyncStatus()
    await loadSubscriptionStatus()
    if (activeSection.value === 'ai') {
      await loadHostedQuota()
    }
  } catch {
    syncError.value = t('settings_error_auth_state')
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
  orphanMessage.value = ''
  syncError.value = ''
  try {
    const response = await exportOrphanOwners()
    if (!response.ok) {
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }
    downloadOrphanExportJson(response.items)
    orphanMessage.value = t('settings_orphan_exported', [String(response.items.length)])
  } catch {
    syncError.value = t('settings_error_orphan_export')
  } finally {
    orphanWorking.value = false
  }
}

async function handleClearOrphans() {
  const confirmed = window.confirm(
    t('settings_orphan_clear_confirm', [
      String(orphanBucketCount.value),
      String(orphanActiveCount.value)
    ])
  )
  if (!confirmed) {
    return
  }

  orphanWorking.value = true
  orphanMessage.value = ''
  syncError.value = ''
  try {
    const response = await clearOrphanOwners()
    if (!response.ok) {
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }
    orphanMessage.value = t('settings_orphan_cleared', [
      String(response.clearedBuckets),
      String(response.clearedItems)
    ])
    await refreshSyncStatus()
  } catch {
    syncError.value = t('settings_error_orphan_clear')
  } finally {
    orphanWorking.value = false
  }
}

/** 从其它标签（如官网登录）返回时刷新同步相关登录态。 */
function refreshSyncContextOnVisible() {
  if (document.visibilityState !== 'visible') {
    return
  }
  // 从官网定价返回时强制刷新订阅快照
  void loadSyncContext().then(() => loadSubscriptionStatus(true))
}

async function handleSyncToggle(event: Event) {
  const switchEl = asMdSwitchElement(event.target)
  if (!switchEl) {
    return
  }
  if (!signedIn.value) {
    switchEl.selected = false
    syncError.value = t('settings_sync_sign_in_required')
    return
  }
  if (switchEl.selected && !subscriptionIsPro.value) {
    switchEl.selected = false
    syncError.value = t('settings_error_sync_pro_required')
    return
  }

  const nextValue = switchEl.selected
  savingSync.value = true
  syncError.value = ''
  syncRestoreMessage.value = ''
  syncMessage.value = ''
  try {
    if (nextValue && !privacyNoticeAcked.value) {
      if (!window.confirm(t('settings_privacy_sync_confirm'))) {
        switchEl.selected = false
        return
      }
      const ack = await ackPrivacyNotice()
      if (!ack.ok) {
        switchEl.selected = false
        syncError.value = tAccountSyncError(ack.errorCode)
        return
      }
      privacyNoticeAcked.value = true
    }

    const response = await setSyncEnabled(nextValue)
    if (!response.ok) {
      switchEl.selected = !nextValue
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }
    syncEnabled.value = response.syncPrefs.enabled
    await refreshSyncStatus()
  } catch {
    switchEl.selected = !nextValue
    syncError.value = t('settings_error_sync_prefs')
  } finally {
    savingSync.value = false
  }
}

/** 删除云端记忆（不动本机）。 */
async function handleDeleteCloudMemory() {
  if (!signedIn.value || dataWorking.value) {
    return
  }
  if (!window.confirm(t('settings_privacy_delete_cloud_confirm'))) {
    return
  }

  dataWorking.value = true
  dataError.value = ''
  dataMessage.value = ''
  try {
    const response = await deleteCloudMemory()
    if (!response.ok) {
      dataError.value = tAccountSyncError(response.errorCode)
      return
    }
    dataMessage.value = t('settings_privacy_delete_cloud_done', [String(response.deletedItems)])
    syncEnabled.value = false
    await refreshSyncStatus()
  } catch {
    dataError.value = t('settings_error_cloud_delete')
  } finally {
    dataWorking.value = false
  }
}

/** 删除账号：云 + Auth + 本机账号桶 + 退登。 */
async function handleDeleteAccount() {
  if (!signedIn.value || dataWorking.value || signingOut.value) {
    return
  }
  if (!window.confirm(t('settings_privacy_delete_account_confirm'))) {
    return
  }

  dataWorking.value = true
  dataError.value = ''
  dataMessage.value = ''
  try {
    const response = await deleteAccount()
    if (!response.ok) {
      dataError.value = tAccountSyncError(response.errorCode)
      return
    }
    dataMessage.value = t('settings_privacy_delete_account_done', [
      String(response.deletedItems),
      String(response.clearedLocalCount)
    ])
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

/** 导出当前 owner 本机记忆。 */
async function handleExportLocalMemory() {
  if (exportWorking.value || dataWorking.value) {
    return
  }
  exportWorking.value = true
  dataError.value = ''
  dataMessage.value = ''
  try {
    const response = await exportLocalMemory()
    if (!response.ok) {
      dataError.value = tAccountSyncError(response.errorCode)
      return
    }
    downloadLocalMemoryExportJson(response.ownerId, response.items)
    dataMessage.value = t('settings_privacy_export_done', [String(response.items.length)])
  } catch {
    dataError.value = t('settings_error_local_export')
  } finally {
    exportWorking.value = false
  }
}

/** 清除本机记忆（不动 Chrome 原生书签）。 */
async function handleClearLocalMemory() {
  if (dataWorking.value || exportWorking.value || signingOut.value) {
    return
  }
  if (!window.confirm(t('settings_data_clear_local_confirm'))) {
    return
  }

  dataWorking.value = true
  dataError.value = ''
  dataMessage.value = ''
  try {
    const response = await clearLocalMemory()
    if (!response.ok) {
      dataError.value = tAccountSyncError(response.errorCode)
      return
    }
    chromeBookmarkIngestEnabled.value = false
    if (response.syncDisabled) {
      syncEnabled.value = false
      dataMessage.value = t('settings_data_clear_local_done_sync_off', [
        String(response.clearedCount)
      ])
    } else {
      dataMessage.value = t('settings_data_clear_local_done', [String(response.clearedCount)])
    }
    await refreshSyncStatus()
  } catch {
    dataError.value = t('settings_error_local_clear')
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
  syncError.value = ''
  syncMessage.value = ''
  try {
    const response = await runIncrementalMemorySync()
    if (!response.ok) {
      syncError.value = response.error
        ? `${tAccountSyncError(response.errorCode)}（${response.error}）`
        : tAccountSyncError(response.errorCode)
      return
    }
    syncMessage.value = t('settings_sync_now_done', [
      String(response.pulled),
      String(response.pushed)
    ])
    await refreshSyncStatus()
  } catch {
    syncError.value = t('settings_error_sync_incremental')
  } finally {
    runningIncrementalSync.value = false
  }
}

/** 用云端最近一次 replace 前备份救回，并拉回本机。 */
async function handleRestoreLatestSyncBackup() {
  if (!signedIn.value || restoringSyncBackup.value) {
    return
  }
  if (!window.confirm(t('settings_sync_restore_backup_confirm'))) {
    return
  }

  restoringSyncBackup.value = true
  syncError.value = ''
  syncRestoreMessage.value = ''
  try {
    const response = await restoreLatestSyncBackup()
    if (!response.ok) {
      syncError.value = response.error
        ? `${tAccountSyncError(response.errorCode)}（${response.error}）`
        : tAccountSyncError(response.errorCode)
      return
    }
    syncRestoreMessage.value = t('settings_sync_restore_backup_done', [String(response.restored)])
    await refreshSyncStatus()
  } catch {
    syncError.value = t('settings_error_sync_restore_backup')
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
  // 规则 1：本机当前账号与本地档皆空 → 不弹窗，直接仅退出（并清官网态）
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
  if (mode === 'sync_then_clear_local' && !showSignOutDataActions.value) {
    signOutError.value = t('settings_sign_out_sync_then_clear_disabled')
    return
  }
  if (mode === 'clear_local' && !showSignOutDataActions.value) {
    return
  }

  signingOut.value = true
  signOutError.value = ''
  try {
    const response = await authSignOut(mode)
    if (!response.ok) {
      signOutError.value = tAccountSyncError(response.errorCode)
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

onMounted(() => {
  void loadCommands()
  void loadUserSettings()
  void loadSyncContext()
  document.addEventListener('visibilitychange', refreshCommandsIfReturnedFromShortcuts)
  document.addEventListener('visibilitychange', refreshSyncContextOnVisible)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', refreshCommandsIfReturnedFromShortcuts)
  document.removeEventListener('visibilitychange', refreshSyncContextOnVisible)
})
</script>

<template>
  <main class="settings-shell">
    <header class="settings-header">
      <AppPageHeader current="settings" class="settings-header-top" />
      <h1 class="settings-title">{{ t('settings_title') }}</h1>
      <p class="settings-subtitle">{{ t('settings_subtitle') }}</p>
    </header>

    <div class="settings-layout">
      <nav class="settings-tabs" :aria-label="t('settings_tabs_aria')">
        <button
          v-for="tab in SETTINGS_SECTION_TABS"
          :key="tab.id"
          type="button"
          class="settings-tab"
          :class="{ 'settings-tab--active': activeSection === tab.id }"
          :aria-current="activeSection === tab.id ? 'page' : undefined"
          @click="selectSection(tab.id)"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>

      <section class="settings-panel" :aria-label="activeSectionLabel">
        <template v-if="activeSection === 'capture'">
          <div class="settings-block" aria-labelledby="settings-capture-heading">
            <div class="settings-section-head">
              <h2 id="settings-capture-heading" class="settings-section-title">
                {{ t('settings_section_capture') }}
              </h2>
              <p class="settings-section-copy">{{ t('settings_section_capture_copy') }}</p>
            </div>

            <p v-if="settingsState === 'loading'" class="settings-status" role="status">
              {{ t('settings_loading') }}
            </p>
            <p v-else-if="settingsState === 'error'" class="settings-error" role="alert">
              {{ settingsError }}
            </p>

            <template v-else>
              <div class="settings-toggle">
                <div class="settings-toggle-copy">
                  <span class="settings-toggle-title">{{
                    t('settings_toggle_selection_toolbar')
                  }}</span>
                  <span class="settings-toggle-hint">{{
                    t('settings_toggle_selection_toolbar_hint')
                  }}</span>
                </div>
                <md-switch
                  :aria-label="t('settings_toggle_selection_toolbar')"
                  :selected="selectionToolbarEnabled"
                  :disabled="savingSelectionToolbar"
                  @change="handleSelectionToolbarToggle"
                />
              </div>
              <div class="settings-toggle">
                <div class="settings-toggle-copy">
                  <span class="settings-toggle-title">{{
                    t('settings_toggle_chrome_bookmark_ingest')
                  }}</span>
                  <span class="settings-toggle-hint">{{
                    t('settings_toggle_chrome_bookmark_ingest_hint')
                  }}</span>
                </div>
                <md-switch
                  :aria-label="t('settings_toggle_chrome_bookmark_ingest')"
                  :selected="chromeBookmarkIngestEnabled"
                  :disabled="savingChromeBookmarkIngest"
                  @change="handleChromeBookmarkIngestToggle"
                />
              </div>
            </template>
            <p
              v-if="settingsState === 'ready' && settingsError"
              class="settings-error"
              role="alert"
            >
              {{ settingsError }}
            </p>
          </div>
        </template>

        <template v-else-if="activeSection === 'shortcuts'">
          <div class="settings-block" aria-labelledby="settings-shortcuts-heading">
            <div class="settings-section-head">
              <h2 id="settings-shortcuts-heading" class="settings-section-title">
                {{ t('settings_section_shortcuts') }}
              </h2>
              <p class="settings-section-copy">{{ t('settings_section_shortcuts_copy') }}</p>
            </div>

            <p v-if="commandsState === 'loading'" class="settings-status" role="status">
              {{ t('settings_commands_loading') }}
            </p>
            <p v-else-if="commandsState === 'error'" class="settings-error" role="alert">
              {{ commandsError }}
            </p>

            <ul v-else class="settings-command-list">
              <li v-for="row in commandRows" :key="row.name" class="settings-command-row">
                <div class="settings-command-meta">
                  <p class="settings-command-title">{{ row.title }}</p>
                </div>
                <p
                  class="settings-command-shortcut"
                  :class="{ 'settings-command-shortcut--unbound': row.unbound }"
                >
                  {{ row.shortcutLabel }}
                </p>
              </li>
            </ul>

            <div class="settings-actions">
              <md-filled-button
                type="button"
                :disabled="openingShortcuts"
                :title="
                  openingShortcuts ? t('settings_opening_shortcuts') : t('settings_open_shortcuts')
                "
                @click="handleOpenShortcutsPage"
              >
                <MaterialSymbolIcon slot="icon" name="open_in_new" size="18px" />
                {{
                  openingShortcuts ? t('settings_opening_shortcuts') : t('settings_open_shortcuts')
                }}
              </md-filled-button>
            </div>
            <p v-if="openShortcutsError" class="settings-error" role="alert">
              {{ openShortcutsError }}
            </p>
          </div>
        </template>

        <template v-else-if="activeSection === 'account_sync'">
          <div class="settings-block" aria-labelledby="settings-sync-heading">
            <div class="settings-section-head">
              <h2 id="settings-sync-heading" class="settings-section-title">
                {{ t('settings_section_sync') }}
              </h2>
              <p class="settings-section-copy">{{ t('settings_section_sync_copy') }}</p>
            </div>

            <div class="settings-toggle">
              <div class="settings-toggle-copy">
                <span class="settings-toggle-title">{{ t('settings_sync_toggle') }}</span>
                <span class="settings-toggle-hint">{{ t('settings_sync_toggle_hint') }}</span>
              </div>
              <md-switch
                :aria-label="t('settings_sync_toggle')"
                :selected="syncEnabled"
                :disabled="savingSync || !signedIn || !subscriptionIsPro"
                @change="handleSyncToggle"
              />
            </div>
            <p v-if="signedIn && !subscriptionIsPro" class="settings-status" role="status">
              {{ t('settings_sync_pro_required_hint') }}
            </p>

            <p v-if="signedIn" class="settings-sync-counts">
              {{ t('settings_sync_local_count', [String(syncLocalCount)]) }}
              ·
              {{ t('settings_sync_remote_count', [String(syncRemoteCount)]) }}
            </p>
            <p v-if="signedIn && syncEnabled && syncLastPulledAt" class="settings-status">
              {{ t('settings_sync_last_pulled', [syncLastPulledAt]) }}
            </p>
            <p v-else-if="!signedIn" class="settings-status">
              {{ t('settings_sync_sign_in_required') }}
            </p>

            <div v-if="signedIn && syncEnabled" class="settings-actions settings-actions--spaced">
              <md-outlined-button
                type="button"
                :disabled="runningIncrementalSync || savingSync || signingOut || orphanWorking"
                :title="t('settings_sync_now')"
                @click="handleRunIncrementalSync"
              >
                {{
                  runningIncrementalSync ? t('settings_sync_now_working') : t('settings_sync_now')
                }}
              </md-outlined-button>
            </div>
            <p v-if="syncMessage" class="settings-status" role="status">{{ syncMessage }}</p>

            <p v-if="signedIn && (accountDisplayName || accountEmail)" class="settings-status">
              {{ accountDisplayName || accountEmail }}
              <template v-if="accountDisplayName && accountEmail"> · {{ accountEmail }}</template>
            </p>

            <div class="settings-subscription" aria-labelledby="settings-subscription-heading">
              <p id="settings-subscription-heading" class="settings-toggle-title">
                {{ t('settings_subscription_title') }}
              </p>
              <p class="settings-section-copy">{{ t('settings_subscription_hybrid_hint') }}</p>
              <p v-if="!signedIn" class="settings-status">
                {{ t('settings_subscription_sign_in_hint') }}
              </p>
              <template v-else>
                <p class="settings-status">
                  <strong>{{ subscriptionTierLabel }}</strong>
                  <template v-if="subscriptionPeriodEnd">
                    ·
                    {{
                      t('settings_subscription_period_end', [
                        new Date(subscriptionPeriodEnd).toLocaleDateString()
                      ])
                    }}
                  </template>
                </p>
                <div class="settings-actions settings-actions--spaced">
                  <md-outlined-button
                    v-if="!subscriptionIsPro && subscriptionUpgradeUrl"
                    type="button"
                    :title="t('settings_subscription_upgrade')"
                    @click="openExternalUrl(subscriptionUpgradeUrl)"
                  >
                    {{ t('settings_subscription_upgrade') }}
                  </md-outlined-button>
                  <md-outlined-button
                    v-if="subscriptionIsPro && subscriptionManageUrl"
                    type="button"
                    :title="t('settings_subscription_manage')"
                    @click="openExternalUrl(subscriptionManageUrl)"
                  >
                    {{ t('settings_subscription_manage') }}
                  </md-outlined-button>
                </div>
              </template>
              <p v-if="subscriptionError" class="settings-error" role="alert">
                {{ subscriptionError }}
              </p>
            </div>

            <div v-if="signedIn" class="settings-sync-restore">
              <p class="settings-section-copy">{{ t('settings_sync_restore_backup_hint') }}</p>
              <div class="settings-actions">
                <md-outlined-button
                  type="button"
                  :disabled="
                    restoringSyncBackup ||
                    savingSync ||
                    signingOut ||
                    orphanWorking ||
                    runningIncrementalSync
                  "
                  :title="t('settings_sync_restore_backup')"
                  @click="handleRestoreLatestSyncBackup"
                >
                  {{
                    restoringSyncBackup
                      ? t('settings_orphan_working')
                      : t('settings_sync_restore_backup')
                  }}
                </md-outlined-button>
              </div>
              <p v-if="syncRestoreMessage" class="settings-status" role="status">
                {{ syncRestoreMessage }}
              </p>
            </div>

            <div v-if="hasOrphanOwners" class="settings-orphan">
              <p class="settings-toggle-title">{{ t('settings_orphan_title') }}</p>
              <p class="settings-section-copy">
                {{
                  t('settings_orphan_copy', [String(orphanBucketCount), String(orphanActiveCount)])
                }}
              </p>
              <div class="settings-actions">
                <md-outlined-button
                  type="button"
                  :disabled="orphanWorking || signingOut || savingSync"
                  :title="t('settings_orphan_export')"
                  @click="handleExportOrphans"
                >
                  {{ orphanWorking ? t('settings_orphan_working') : t('settings_orphan_export') }}
                </md-outlined-button>
                <md-outlined-button
                  type="button"
                  :disabled="orphanWorking || signingOut || savingSync"
                  :title="t('settings_orphan_clear')"
                  @click="handleClearOrphans"
                >
                  {{ orphanWorking ? t('settings_orphan_working') : t('settings_orphan_clear') }}
                </md-outlined-button>
              </div>
              <p v-if="orphanMessage" class="settings-status" role="status">{{ orphanMessage }}</p>
            </div>

            <div v-if="signedIn" class="settings-actions settings-actions--spaced">
              <md-outlined-button
                type="button"
                :disabled="signingOut || savingSync || orphanWorking"
                :title="t('settings_account_sign_out')"
                @click="openSignOutDialog"
              >
                {{
                  signingOut ? t('settings_account_signing_out') : t('settings_account_sign_out')
                }}
              </md-outlined-button>
              <md-text-button
                type="button"
                :disabled="signingOut || savingSync || orphanWorking || dataWorking"
                :title="t('settings_account_open_delete_account')"
                @click="selectSection('data')"
              >
                {{ t('settings_account_open_delete_account') }}
              </md-text-button>
            </div>

            <p v-if="syncError" class="settings-error" role="alert">{{ syncError }}</p>
          </div>
        </template>

        <template v-else-if="activeSection === 'data'">
          <div class="settings-block" aria-labelledby="settings-data-heading">
            <div class="settings-section-head">
              <h2 id="settings-data-heading" class="settings-section-title">
                {{ t('settings_tab_data') }}
              </h2>
              <p class="settings-section-copy">{{ t('settings_data_intro') }}</p>
            </div>

            <div class="settings-privacy-danger">
              <p class="settings-toggle-title">{{ t('settings_privacy_export') }}</p>
              <p class="settings-section-copy">{{ t('settings_privacy_export_hint') }}</p>
              <div class="settings-actions">
                <md-outlined-button
                  type="button"
                  :disabled="exportWorking || dataWorking || signingOut"
                  :title="t('settings_privacy_export')"
                  @click="handleExportLocalMemory"
                >
                  {{ exportWorking ? t('settings_privacy_working') : t('settings_privacy_export') }}
                </md-outlined-button>
              </div>
            </div>

            <div class="settings-privacy-danger">
              <p class="settings-toggle-title">{{ t('settings_data_clear_local') }}</p>
              <p class="settings-section-copy">{{ t('settings_data_clear_local_hint') }}</p>
              <div class="settings-actions">
                <md-outlined-button
                  type="button"
                  :disabled="dataWorking || exportWorking || signingOut"
                  :title="t('settings_data_clear_local')"
                  @click="handleClearLocalMemory"
                >
                  {{ dataWorking ? t('settings_privacy_working') : t('settings_data_clear_local') }}
                </md-outlined-button>
              </div>
            </div>

            <div v-if="signedIn" class="settings-privacy-danger">
              <p class="settings-toggle-title">{{ t('settings_privacy_delete_cloud') }}</p>
              <p class="settings-section-copy">{{ t('settings_privacy_delete_cloud_hint') }}</p>
              <div class="settings-actions">
                <md-outlined-button
                  type="button"
                  :disabled="dataWorking || signingOut || savingSync"
                  :title="t('settings_privacy_delete_cloud')"
                  @click="handleDeleteCloudMemory"
                >
                  {{
                    dataWorking ? t('settings_privacy_working') : t('settings_privacy_delete_cloud')
                  }}
                </md-outlined-button>
              </div>

              <p class="settings-toggle-title settings-privacy-danger__title-spaced">
                {{ t('settings_privacy_delete_account') }}
              </p>
              <p class="settings-section-copy">{{ t('settings_privacy_delete_account_hint') }}</p>
              <div class="settings-actions">
                <md-outlined-button
                  type="button"
                  :disabled="dataWorking || signingOut || savingSync"
                  :title="t('settings_privacy_delete_account')"
                  @click="handleDeleteAccount"
                >
                  {{
                    dataWorking
                      ? t('settings_privacy_working')
                      : t('settings_privacy_delete_account')
                  }}
                </md-outlined-button>
              </div>
            </div>
            <p v-else class="settings-status">{{ t('settings_privacy_delete_cloud_sign_in') }}</p>

            <p v-if="dataMessage" class="settings-status" role="status">{{ dataMessage }}</p>
            <p v-if="dataError" class="settings-error" role="alert">{{ dataError }}</p>
          </div>
        </template>

        <template v-else-if="activeSection === 'privacy'">
          <div class="settings-block" aria-labelledby="settings-privacy-heading">
            <div class="settings-section-head">
              <h2 id="settings-privacy-heading" class="settings-section-title">
                {{ t('settings_tab_privacy') }}
              </h2>
              <p class="settings-section-copy">{{ t('settings_privacy_intro') }}</p>
            </div>

            <ul class="settings-privacy-list">
              <li>{{ t('settings_privacy_bullet_local') }}</li>
              <li>{{ t('settings_privacy_bullet_cloud') }}</li>
              <li>{{ t('settings_privacy_bullet_account') }}</li>
              <li>{{ t('settings_privacy_bullet_ai') }}</li>
              <li>{{ t('settings_privacy_bullet_not_collected') }}</li>
            </ul>

            <div class="settings-actions">
              <a
                class="settings-privacy-policy-link"
                :href="privacyPolicyUrl"
                target="_blank"
                rel="noopener noreferrer"
                :title="t('settings_privacy_open_policy')"
              >
                {{ t('settings_privacy_open_policy') }}
              </a>
              <a
                class="settings-privacy-policy-link"
                :href="termsOfServiceUrl"
                target="_blank"
                rel="noopener noreferrer"
                :title="t('settings_privacy_open_terms')"
              >
                {{ t('settings_privacy_open_terms') }}
              </a>
            </div>
          </div>
        </template>

        <template v-else-if="activeSection === 'ai'">
          <div class="settings-block" aria-labelledby="settings-ai-heading">
            <div class="settings-section-head">
              <h2 id="settings-ai-heading" class="settings-section-title">
                {{ t('settings_tab_ai') }}
              </h2>
              <p class="settings-section-copy">{{ t('settings_ai_intro') }}</p>
            </div>

            <div class="settings-toggle">
              <div class="settings-toggle-copy">
                <span class="settings-toggle-title">{{ t('settings_ai_toggle') }}</span>
                <span class="settings-toggle-hint">{{ t('settings_ai_toggle_hint') }}</span>
              </div>
              <md-switch
                :selected="aiFeaturesEnabled"
                :disabled="savingAiFeatures || settingsState !== 'ready'"
                :title="t('settings_ai_toggle')"
                @change="handleAiFeaturesToggle"
              />
            </div>

            <p class="settings-section-copy">{{ t('settings_ai_model_note') }}</p>
            <ul class="settings-privacy-list">
              <li>{{ t('settings_ai_bullet_clue') }}</li>
              <li>{{ t('settings_ai_bullet_enrichment') }}</li>
              <li>{{ t('settings_ai_bullet_boundary') }}</li>
            </ul>
            <p v-if="hostedQuotaLoading" class="settings-section-copy" role="status">
              {{ t('settings_ai_quota_loading') }}
            </p>
            <p v-else-if="hostedQuotaText" class="settings-section-copy" role="status">
              {{ hostedQuotaText }}
            </p>
            <p v-if="hostedQuotaError" class="settings-error" role="alert">
              {{ hostedQuotaError }}
            </p>
            <p class="settings-section-copy">{{ t('settings_ai_embedding_hint') }}</p>
            <div class="settings-actions">
              <md-outlined-button
                type="button"
                :disabled="
                  embeddingBackfillWorking ||
                  !signedIn ||
                  !aiFeaturesEnabled ||
                  settingsState !== 'ready'
                "
                :title="t('settings_embedding_backfill')"
                @click="handleEmbeddingBackfill"
              >
                {{
                  embeddingBackfillWorking
                    ? t('settings_embedding_backfill_working')
                    : t('settings_embedding_backfill')
                }}
              </md-outlined-button>
            </div>
            <p v-if="!signedIn" class="settings-status" role="status">
              {{ t('settings_embedding_backfill_auth_required') }}
            </p>
            <p v-if="embeddingBackfillMessage" class="settings-section-copy" role="status">
              {{ embeddingBackfillMessage }}
            </p>
            <a
              class="settings-privacy-policy-link"
              :href="privacyPolicyUrl"
              target="_blank"
              rel="noopener noreferrer"
              :title="t('settings_privacy_open_policy')"
            >
              {{ t('settings_privacy_open_policy') }}
            </a>
            <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>
          </div>
        </template>
      </section>
    </div>

    <div
      v-if="signOutDialogOpen"
      class="settings-sign-out-backdrop"
      role="presentation"
      @click.self="closeSignOutDialog"
    >
      <div
        class="settings-sign-out-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('settings_sign_out_dialog_title')"
      >
        <h2 class="settings-sign-out-dialog__title">{{ t('settings_sign_out_dialog_title') }}</h2>
        <p v-if="accountEmail" class="settings-section-copy">{{ accountEmail }}</p>
        <p class="settings-section-copy">{{ t('settings_sign_out_dialog_copy') }}</p>
        <p class="settings-sync-counts">
          {{
            t('settings_sign_out_dialog_counts', [
              String(syncAccountOwnerCount),
              String(syncLocalProfileOwnerCount),
              String(syncRemoteCount)
            ])
          }}
        </p>

        <div class="settings-sign-out-options">
          <md-filled-button
            type="button"
            :disabled="signingOut"
            :title="t('settings_sign_out_keep_local_hint')"
            @click="confirmSignOut('keep_local')"
          >
            {{ t('settings_sign_out_keep_local') }}
          </md-filled-button>
          <p class="settings-sign-out-option-hint">{{ t('settings_sign_out_keep_local_hint') }}</p>

          <template v-if="showSignOutDataActions">
            <md-outlined-button
              type="button"
              :disabled="signingOut"
              :title="t('settings_sign_out_clear_local_hint')"
              @click="confirmSignOut('clear_local')"
            >
              {{ t('settings_sign_out_clear_local') }}
            </md-outlined-button>
            <p class="settings-sign-out-option-hint">
              {{ t('settings_sign_out_clear_local_hint') }}
            </p>

            <md-outlined-button
              type="button"
              :disabled="signingOut"
              :title="t('settings_sign_out_sync_then_clear_hint')"
              @click="confirmSignOut('sync_then_clear_local')"
            >
              {{ t('settings_sign_out_sync_then_clear') }}
            </md-outlined-button>
            <p class="settings-sign-out-option-hint">
              {{ t('settings_sign_out_sync_then_clear_hint') }}
            </p>
          </template>
        </div>

        <div class="settings-actions">
          <md-text-button type="button" :disabled="signingOut" @click="closeSignOutDialog">
            {{ t('settings_sign_out_cancel') }}
          </md-text-button>
        </div>
        <p v-if="signOutError" class="settings-error" role="alert">{{ signOutError }}</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.settings-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-width: 960px;
  height: 100%;
  margin: 0 auto;
  padding: 28px 24px 24px;
  color: var(--on-surface);
  overflow: hidden;
}

.settings-header {
  flex-shrink: 0;
  margin-bottom: 24px;
}

.settings-header-top {
  margin-bottom: 4px;
}

.settings-title {
  margin: 0 0 8px;
  font-size: 28px;
  line-height: 1.2;
}

.settings-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.settings-layout {
  display: grid;
  flex: 1;
  align-items: stretch;
  gap: 20px;
  grid-template-columns: 160px minmax(0, 1fr);
  min-height: 0;
}

.settings-tabs {
  display: grid;
  align-self: start;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-tab {
  margin: 0;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
}

.settings-tab:hover {
  background: color-mix(in srgb, var(--on-surface) 6%, transparent);
}

.settings-tab--active {
  color: var(--on-surface);
  background: var(--surface-chrome);
}

.settings-panel {
  min-width: 0;
  min-height: 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  overflow: hidden auto;
}

.settings-block + .settings-block {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.settings-section-head {
  margin-bottom: 14px;
}

.settings-section-title {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.3;
}

.settings-block--placeholder .settings-section-title {
  margin-bottom: 8px;
}

.settings-section-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.settings-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-toggle-copy {
  display: grid;
  gap: 4px;
}

.settings-toggle-title {
  font-size: 14px;
  font-weight: 600;
}

.settings-toggle-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.settings-status {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--on-surface-muted);
}

.settings-error {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--danger);
}

.settings-command-list {
  display: grid;
  gap: 10px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.settings-command-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-command-meta {
  min-width: 0;
}

.settings-command-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.settings-command-shortcut {
  flex-shrink: 0;
  margin: 0;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  background: var(--surface-accent-soft);
}

.settings-command-shortcut--unbound {
  color: var(--sage-dark);
  background: color-mix(in srgb, var(--sage) 18%, var(--paper));
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.settings-actions--spaced {
  margin-top: 14px;
}

.settings-sync-counts {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--on-surface-muted);
}

.settings-sync-restore {
  margin-top: 14px;
}

.settings-privacy-list {
  margin: 12px 0 0;
  padding-left: 1.25rem;
  font-size: 13px;
  line-height: 1.55;
  color: var(--on-surface-muted);
}

.settings-privacy-danger {
  margin-top: 18px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-privacy-danger__title-spaced {
  margin-top: 16px;
}

.settings-privacy-policy-link {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  font-size: 14px;
  line-height: 1.4;
  text-decoration: underline;
  color: var(--accent);
  text-underline-offset: 2px;
}

.settings-privacy-policy-link:hover,
.settings-privacy-policy-link:focus-visible {
  outline: none;
  color: var(--ink);
}

.settings-orphan {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-sign-out-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--ink) 42%, transparent);
}

.settings-sign-out-dialog {
  width: min(100%, 420px);
  max-height: min(90vh, 640px);
  padding: 20px 18px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  overflow: auto;
  box-shadow: var(--md-sys-elevation-level3, 0 8px 24px rgb(0 0 0 / 18%));
}

.settings-sign-out-dialog__title {
  margin: 0 0 10px;
  font-size: 18px;
  line-height: 1.3;
}

.settings-sign-out-options {
  display: grid;
  gap: 6px;
  margin: 16px 0 12px;
}

.settings-sign-out-option-hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

@media (width <= 640px) {
  .settings-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .settings-tabs {
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
  }

  .settings-tab {
    text-align: center;
  }
}
</style>

<style>
/* 本页独立入口：锁死视口，避免整页滚动条；仅右侧面板滚动 */
html,
body,
#app {
  height: 100%;
  overflow: hidden;
}
</style>
