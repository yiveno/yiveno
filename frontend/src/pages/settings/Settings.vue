<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue'

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
import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'
import {
  tAccountSyncError,
  tCommandsError,
  tSettingsError
} from '@/infrastructure/i18n/background-error'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'
import { t } from '@/infrastructure/i18n/t'
import { getWebsiteBaseUrl } from '@/infrastructure/browser/website-page'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppModal from '@/infrastructure/ui/AppModal.vue'
import AppConfirmModal from '@/infrastructure/ui/AppConfirmModal.vue'
import AppSectionTabs from '@/infrastructure/ui/AppSectionTabs.vue'
import AppSwitch from '@/infrastructure/ui/AppSwitch.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import SettingsActionRow from '@/pages/settings/SettingsActionRow.vue'

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
const deleteAccountDialogOpen = ref(false)
/** 通用危险/确认弹窗（替代 window.confirm） */
type SettingsConfirmAction =
  | 'clear_local'
  | 'delete_cloud'
  | 'clear_orphans'
  | 'privacy_sync'
  | 'restore_backup'

const confirmDialogAction = ref<SettingsConfirmAction | null>(null)
const confirmDialogError = ref('')
/** privacy_sync 确认后继续执行的开关目标值 */
const pendingSyncEnable = ref<boolean | null>(null)
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

const settingsSectionTabsId = useId()
const settingsPanelId = `${settingsSectionTabsId}-panel`
const settingsActiveTabId = computed(() => `${settingsSectionTabsId}-tab-${activeSection.value}`)

const settingsSectionTabItems = computed(() =>
  SETTINGS_SECTION_TABS.map(tab => ({
    id: tab.id,
    label: t(tab.labelKey)
  }))
)

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
  if (orphanWorking.value || signingOut.value || savingSync.value) {
    return
  }
  confirmDialogError.value = ''
  confirmDialogAction.value = 'clear_orphans'
}

async function executeClearOrphans(): Promise<boolean> {
  orphanWorking.value = true
  orphanMessage.value = ''
  syncError.value = ''
  try {
    const response = await clearOrphanOwners()
    if (!response.ok) {
      confirmDialogError.value = tAccountSyncError(response.errorCode)
      return false
    }
    orphanMessage.value = t('settings_orphan_cleared', [
      String(response.clearedBuckets),
      String(response.clearedItems)
    ])
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
  if (document.visibilityState !== 'visible') {
    return
  }
  // 从官网定价返回时强制刷新订阅快照
  void loadSyncContext().then(() => loadSubscriptionStatus(true))
}

async function handleSyncToggle(nextValue: boolean) {
  if (!signedIn.value) {
    syncError.value = t('settings_sync_sign_in_required')
    return
  }
  if (nextValue && !subscriptionIsPro.value) {
    syncError.value = t('settings_error_sync_pro_required')
    return
  }

  savingSync.value = true
  syncError.value = ''
  syncRestoreMessage.value = ''
  syncMessage.value = ''
  try {
    if (nextValue && !privacyNoticeAcked.value) {
      pendingSyncEnable.value = nextValue
      confirmDialogError.value = ''
      confirmDialogAction.value = 'privacy_sync'
      return
    }

    const response = await setSyncEnabled(nextValue)
    if (!response.ok) {
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }
    syncEnabled.value = response.syncPrefs.enabled
    await refreshSyncStatus()
  } catch {
    syncError.value = t('settings_error_sync_prefs')
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
  dataMessage.value = ''
  try {
    const response = await deleteCloudMemory()
    if (!response.ok) {
      confirmDialogError.value = tAccountSyncError(response.errorCode)
      return false
    }
    dataMessage.value = t('settings_privacy_delete_cloud_done', [String(response.deletedItems)])
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
  dataMessage.value = ''
  try {
    const response = await deleteAccount()
    if (!response.ok) {
      dataError.value = tAccountSyncError(response.errorCode)
      return
    }
    deleteAccountDialogOpen.value = false
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
  syncError.value = ''
  syncRestoreMessage.value = ''
  syncMessage.value = ''
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
function handleClearLocalMemory() {
  if (dataWorking.value || exportWorking.value || signingOut.value) {
    return
  }
  confirmDialogError.value = ''
  confirmDialogAction.value = 'clear_local'
}

async function executeClearLocalMemory(): Promise<boolean> {
  dataWorking.value = true
  dataError.value = ''
  dataMessage.value = ''
  try {
    const response = await clearLocalMemory()
    if (!response.ok) {
      confirmDialogError.value = tAccountSyncError(response.errorCode)
      return false
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
function handleRestoreLatestSyncBackup() {
  if (!signedIn.value || restoringSyncBackup.value) {
    return
  }
  confirmDialogError.value = ''
  confirmDialogAction.value = 'restore_backup'
}

async function executeRestoreLatestSyncBackup(): Promise<boolean> {
  restoringSyncBackup.value = true
  syncError.value = ''
  syncRestoreMessage.value = ''
  try {
    const response = await restoreLatestSyncBackup()
    if (!response.ok) {
      confirmDialogError.value = response.error
        ? `${tAccountSyncError(response.errorCode)}（${response.error}）`
        : tAccountSyncError(response.errorCode)
      return false
    }
    syncRestoreMessage.value = t('settings_sync_restore_backup_done', [String(response.restored)])
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

/** 取消登录态 storage 订阅。 */
let stopWatchAuthSession: (() => void) | null = null

onMounted(() => {
  void loadCommands()
  void loadUserSettings()
  void loadSyncContext()
  // 官网 handoff / 扩展内登出：立即刷新 signedIn、同步与配额，不依赖切回前台
  stopWatchAuthSession = watchAuthSessionStorage(() => {
    void loadSyncContext()
  })
  document.addEventListener('visibilitychange', refreshCommandsIfReturnedFromShortcuts)
  document.addEventListener('visibilitychange', refreshSyncContextOnVisible)
})

onUnmounted(() => {
  stopWatchAuthSession?.()
  stopWatchAuthSession = null
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
      <AppSectionTabs
        v-model="activeSection"
        class="settings-section-tabs"
        :items="settingsSectionTabItems"
        :aria-label="t('settings_tabs_aria')"
        :panel-id="settingsPanelId"
        :id-prefix="settingsSectionTabsId"
      />

      <section
        :id="settingsPanelId"
        class="settings-panel surface-panel-white"
        role="tabpanel"
        :aria-labelledby="settingsActiveTabId"
        :aria-label="activeSectionLabel"
        tabindex="0"
      >
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
              <div class="settings-card-stack">
                <div class="settings-toggle">
                  <div class="settings-toggle-copy">
                    <span class="settings-toggle-title">{{
                      t('settings_toggle_selection_toolbar')
                    }}</span>
                    <span class="settings-toggle-hint">{{
                      t('settings_toggle_selection_toolbar_hint')
                    }}</span>
                  </div>
                  <AppSwitch
                    :aria-label="t('settings_toggle_selection_toolbar')"
                    :model-value="selectionToolbarEnabled"
                    :disabled="savingSelectionToolbar"
                    @update:model-value="handleSelectionToolbarToggle"
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
                  <AppSwitch
                    :aria-label="t('settings_toggle_chrome_bookmark_ingest')"
                    :model-value="chromeBookmarkIngestEnabled"
                    :disabled="savingChromeBookmarkIngest"
                    @update:model-value="handleChromeBookmarkIngestToggle"
                  />
                </div>
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

            <template v-else>
              <ul class="settings-command-list">
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

              <SettingsActionRow
                :title="t('settings_open_shortcuts')"
                :subtitle="t('settings_shortcuts_open_hint')"
              >
                <AppButton
                  type="button"
                  :disabled="openingShortcuts"
                  :title="t('settings_open_shortcuts')"
                  @click="handleOpenShortcutsPage"
                  variant="outlined"
                >
                  {{
                    openingShortcuts
                      ? t('settings_opening_shortcuts')
                      : t('settings_open_shortcuts_action')
                  }}
                </AppButton>
              </SettingsActionRow>
            </template>
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
              <AppSwitch
                :aria-label="t('settings_sync_toggle')"
                :model-value="syncEnabled"
                :disabled="savingSync || !signedIn || !subscriptionIsPro"
                @update:model-value="handleSyncToggle"
              />
            </div>
            <p v-if="signedIn && !subscriptionIsPro" class="settings-status" role="status">
              {{ t('settings_sync_pro_required_hint') }}
            </p>

            <div v-if="signedIn" class="settings-status-strip">
              <p class="settings-status-strip__line">
                {{ t('settings_sync_local_count', [String(syncLocalCount)]) }}
                ·
                {{ t('settings_sync_remote_count', [String(syncRemoteCount)]) }}
                <template v-if="syncEnabled && syncLastPulledAt">
                  ·
                  {{ t('settings_sync_last_pulled', [syncLastPulledAt]) }}
                </template>
              </p>
              <p
                v-if="accountDisplayName || accountEmail"
                class="settings-status-strip__line settings-status-strip__line--account"
              >
                {{ accountDisplayName || accountEmail }}
                <template v-if="accountDisplayName && accountEmail"> · {{ accountEmail }}</template>
              </p>
            </div>
            <p v-else class="settings-status">{{ t('settings_sync_sign_in_required') }}</p>

            <div v-if="signedIn && syncEnabled" class="settings-actions">
              <AppButton
                type="button"
                :disabled="runningIncrementalSync || savingSync || signingOut || orphanWorking"
                :title="t('settings_sync_now')"
                @click="handleRunIncrementalSync"
                variant="outlined"
              >
                {{
                  runningIncrementalSync ? t('settings_sync_now_working') : t('settings_sync_now')
                }}
              </AppButton>
            </div>
            <p v-if="syncMessage" class="settings-status" role="status">{{ syncMessage }}</p>

            <div class="settings-subsection" aria-labelledby="settings-subscription-heading">
              <h3 id="settings-subscription-heading" class="settings-subsection-title">
                {{ t('settings_subscription_title') }}
              </h3>
              <SettingsActionRow
                v-if="signedIn"
                :title="subscriptionPlanRowTitle"
                :subtitle="t('settings_subscription_hybrid_hint')"
              >
                <AppButton
                  v-if="!subscriptionIsPro && subscriptionUpgradeUrl"
                  type="button"
                  :title="t('settings_subscription_upgrade')"
                  @click="openExternalUrl(subscriptionUpgradeUrl)"
                  variant="outlined"
                >
                  {{ t('settings_subscription_upgrade') }}
                </AppButton>
                <AppButton
                  v-else-if="subscriptionIsPro && subscriptionManageUrl"
                  type="button"
                  :title="t('settings_subscription_manage')"
                  @click="openExternalUrl(subscriptionManageUrl)"
                  variant="outlined"
                >
                  {{ t('settings_subscription_manage') }}
                </AppButton>
              </SettingsActionRow>
              <p v-else class="settings-status">{{ t('settings_subscription_sign_in_hint') }}</p>
              <p v-if="subscriptionError" class="settings-error" role="alert">
                {{ subscriptionError }}
              </p>
            </div>

            <div
              v-if="signedIn"
              class="settings-subsection"
              aria-labelledby="settings-advanced-heading"
            >
              <h3 id="settings-advanced-heading" class="settings-subsection-title">
                {{ t('settings_section_advanced') }}
              </h3>
              <div class="settings-card-stack">
                <SettingsActionRow
                  :title="t('settings_sync_restore_backup')"
                  :subtitle="t('settings_sync_restore_backup_hint')"
                >
                  <AppButton
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
                    variant="outlined"
                  >
                    {{
                      restoringSyncBackup
                        ? t('settings_orphan_working')
                        : t('settings_sync_restore_backup_action')
                    }}
                  </AppButton>
                </SettingsActionRow>

                <div v-if="hasOrphanOwners" class="settings-orphan">
                  <p class="settings-orphan-title">{{ t('settings_orphan_title') }}</p>
                  <p class="settings-section-copy settings-orphan-copy">
                    {{
                      t('settings_orphan_copy', [
                        String(orphanBucketCount),
                        String(orphanActiveCount)
                      ])
                    }}
                  </p>
                  <div class="settings-actions">
                    <AppButton
                      type="button"
                      :disabled="orphanWorking || signingOut || savingSync"
                      :title="t('settings_orphan_export')"
                      @click="handleExportOrphans"
                      variant="outlined"
                    >
                      {{
                        orphanWorking ? t('settings_orphan_working') : t('settings_orphan_export')
                      }}
                    </AppButton>
                    <AppButton
                      type="button"
                      :disabled="orphanWorking || signingOut || savingSync"
                      :title="t('settings_orphan_clear')"
                      @click="handleClearOrphans"
                      variant="outlined"
                    >
                      {{
                        orphanWorking ? t('settings_orphan_working') : t('settings_orphan_clear')
                      }}
                    </AppButton>
                  </div>
                  <p v-if="orphanMessage" class="settings-status" role="status">
                    {{ orphanMessage }}
                  </p>
                </div>
              </div>
              <p v-if="syncRestoreMessage" class="settings-status" role="status">
                {{ syncRestoreMessage }}
              </p>
            </div>

            <div v-if="signedIn" class="settings-actions settings-actions--spaced">
              <AppButton
                type="button"
                :disabled="signingOut || savingSync || orphanWorking"
                :title="t('settings_account_sign_out')"
                @click="openSignOutDialog"
                variant="outlined"
              >
                {{
                  signingOut ? t('settings_account_signing_out') : t('settings_account_sign_out')
                }}
              </AppButton>
            </div>

            <p v-if="dataMessage" class="settings-status" role="status">{{ dataMessage }}</p>
            <p v-if="dataError" class="settings-error" role="alert">{{ dataError }}</p>
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

            <div class="settings-card-stack">
              <SettingsActionRow
                :title="t('settings_privacy_export')"
                :subtitle="t('settings_privacy_export_hint')"
              >
                <AppButton
                  type="button"
                  :disabled="exportWorking || dataWorking || signingOut"
                  :title="t('settings_privacy_export')"
                  @click="handleExportLocalMemory"
                  variant="outlined"
                >
                  {{
                    exportWorking
                      ? t('settings_privacy_working')
                      : t('settings_privacy_export_action')
                  }}
                </AppButton>
              </SettingsActionRow>

              <SettingsActionRow
                :title="t('settings_data_clear_local')"
                :subtitle="t('settings_data_clear_local_hint')"
              >
                <AppButton
                  type="button"
                  :disabled="dataWorking || exportWorking || signingOut"
                  :title="t('settings_data_clear_local')"
                  @click="handleClearLocalMemory"
                  variant="outlined"
                >
                  {{
                    dataWorking
                      ? t('settings_privacy_working')
                      : t('settings_data_clear_local_action')
                  }}
                </AppButton>
              </SettingsActionRow>

              <template v-if="signedIn">
                <SettingsActionRow
                  :title="t('settings_privacy_delete_cloud')"
                  :subtitle="t('settings_privacy_delete_cloud_hint')"
                  tone="danger"
                >
                  <AppButton
                    type="button"
                    :disabled="dataWorking || signingOut || savingSync"
                    :title="t('settings_privacy_delete_cloud')"
                    @click="handleDeleteCloudMemory"
                    variant="outlined"
                    tone="danger"
                  >
                    {{
                      dataWorking
                        ? t('settings_privacy_working')
                        : t('settings_privacy_delete_cloud_action')
                    }}
                  </AppButton>
                </SettingsActionRow>

                <SettingsActionRow
                  :title="t('settings_privacy_delete_account')"
                  :subtitle="t('settings_privacy_delete_account_hint')"
                  tone="danger"
                >
                  <AppButton
                    type="button"
                    tone="danger"
                    :disabled="dataWorking || signingOut || savingSync"
                    :title="t('settings_privacy_delete_account')"
                    @click="openDeleteAccountDialog"
                    variant="outlined"
                  >
                    {{
                      dataWorking
                        ? t('settings_privacy_working')
                        : t('settings_privacy_delete_account_action')
                    }}
                  </AppButton>
                </SettingsActionRow>
              </template>
            </div>
            <p v-if="!signedIn" class="settings-status">
              {{ t('settings_privacy_delete_cloud_sign_in') }}
            </p>

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

            <details class="settings-details">
              <summary class="settings-details__summary">
                <span class="settings-details__summary-label">
                  {{ t('settings_privacy_details_summary') }}
                </span>
                <span class="settings-details__chevrons" aria-hidden="true">
                  <AppIcon
                    class="settings-details__chevron settings-details__chevron--down"
                    name="expand_more"
                    size="18px"
                  />
                  <AppIcon
                    class="settings-details__chevron settings-details__chevron--up"
                    name="chevron_up"
                    size="18px"
                  />
                </span>
              </summary>
              <ul class="settings-details__list">
                <li>{{ t('settings_privacy_bullet_local') }}</li>
                <li>{{ t('settings_privacy_bullet_cloud') }}</li>
                <li>{{ t('settings_privacy_bullet_account') }}</li>
                <li>{{ t('settings_privacy_bullet_ai') }}</li>
                <li>{{ t('settings_privacy_bullet_not_collected') }}</li>
              </ul>
            </details>

            <div class="settings-card-stack settings-card-stack--spaced">
              <SettingsActionRow
                :title="t('settings_privacy_open_policy')"
                :subtitle="t('settings_privacy_open_policy_hint')"
              >
                <AppButton
                  :href="privacyPolicyUrl"
                  :title="t('settings_privacy_open_policy')"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                >
                  {{ t('settings_privacy_open_policy_action') }}
                </AppButton>
              </SettingsActionRow>
              <SettingsActionRow
                :title="t('settings_privacy_open_terms')"
                :subtitle="t('settings_privacy_open_terms_hint')"
              >
                <AppButton
                  :href="termsOfServiceUrl"
                  :title="t('settings_privacy_open_terms')"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                >
                  {{ t('settings_privacy_open_terms_action') }}
                </AppButton>
              </SettingsActionRow>
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
              <AppSwitch
                :model-value="aiFeaturesEnabled"
                :disabled="savingAiFeatures || settingsState !== 'ready'"
                :aria-label="t('settings_ai_toggle')"
                @update:model-value="handleAiFeaturesToggle"
              />
            </div>

            <details class="settings-details">
              <summary class="settings-details__summary">
                <span class="settings-details__summary-label">
                  {{ t('settings_ai_details_summary') }}
                </span>
                <span class="settings-details__chevrons" aria-hidden="true">
                  <AppIcon
                    class="settings-details__chevron settings-details__chevron--down"
                    name="expand_more"
                    size="18px"
                  />
                  <AppIcon
                    class="settings-details__chevron settings-details__chevron--up"
                    name="chevron_up"
                    size="18px"
                  />
                </span>
              </summary>
              <p class="settings-details__lead">{{ t('settings_ai_model_note') }}</p>
              <ul class="settings-details__list">
                <li>{{ t('settings_ai_bullet_clue') }}</li>
                <li>{{ t('settings_ai_bullet_enrichment') }}</li>
                <li>{{ t('settings_ai_bullet_boundary') }}</li>
              </ul>
            </details>

            <div
              v-if="hostedQuotaLoading || hostedQuotaText || hostedQuotaError"
              class="settings-status-strip settings-status-strip--spaced"
            >
              <p v-if="hostedQuotaLoading" class="settings-status-strip__line" role="status">
                {{ t('settings_ai_quota_loading') }}
              </p>
              <p v-else-if="hostedQuotaText" class="settings-status-strip__line" role="status">
                {{ hostedQuotaText }}
              </p>
              <p
                v-if="hostedQuotaError"
                class="settings-status-strip__line settings-error"
                role="alert"
              >
                {{ hostedQuotaError }}
              </p>
            </div>

            <div class="settings-card-stack settings-card-stack--spaced">
              <SettingsActionRow
                :title="t('settings_embedding_backfill')"
                :subtitle="t('settings_ai_embedding_hint')"
              >
                <AppButton
                  type="button"
                  :disabled="
                    embeddingBackfillWorking ||
                    !signedIn ||
                    !aiFeaturesEnabled ||
                    settingsState !== 'ready'
                  "
                  :title="t('settings_embedding_backfill')"
                  @click="handleEmbeddingBackfill"
                  variant="outlined"
                >
                  {{
                    embeddingBackfillWorking
                      ? t('settings_embedding_backfill_working')
                      : t('settings_embedding_backfill_action')
                  }}
                </AppButton>
              </SettingsActionRow>

              <SettingsActionRow
                :title="t('settings_privacy_open_policy')"
                :subtitle="t('settings_privacy_open_policy_hint')"
              >
                <AppButton
                  :href="privacyPolicyUrl"
                  :title="t('settings_privacy_open_policy')"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                >
                  {{ t('settings_privacy_open_policy_action') }}
                </AppButton>
              </SettingsActionRow>
            </div>
            <p v-if="!signedIn" class="settings-status" role="status">
              {{ t('settings_embedding_backfill_auth_required') }}
            </p>
            <p v-if="embeddingBackfillMessage" class="settings-status" role="status">
              {{ embeddingBackfillMessage }}
            </p>

            <p v-if="settingsError" class="settings-error" role="alert">{{ settingsError }}</p>
          </div>
        </template>
      </section>
    </div>

    <AppModal
      :open="signOutDialogOpen"
      :title="t('settings_sign_out_dialog_title')"
      :loading="signingOut"
      close-on-backdrop
      size="md"
      @close="closeSignOutDialog"
    >
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
        <AppButton
          type="button"
          :disabled="signingOut"
          @click="confirmSignOut('keep_local')"
          variant="filled"
        >
          {{ t('settings_sign_out_keep_local') }}
        </AppButton>
        <p class="settings-sign-out-option-hint">{{ t('settings_sign_out_keep_local_hint') }}</p>

        <template v-if="showSignOutDataActions">
          <AppButton
            type="button"
            :disabled="signingOut"
            @click="confirmSignOut('clear_local')"
            variant="outlined"
          >
            {{ t('settings_sign_out_clear_local') }}
          </AppButton>
          <p class="settings-sign-out-option-hint">
            {{ t('settings_sign_out_clear_local_hint') }}
          </p>

          <AppButton
            type="button"
            :disabled="signingOut"
            @click="confirmSignOut('sync_then_clear_local')"
            variant="outlined"
          >
            {{ t('settings_sign_out_sync_then_clear') }}
          </AppButton>
          <p class="settings-sign-out-option-hint">
            {{ t('settings_sign_out_sync_then_clear_hint') }}
          </p>
        </template>
      </div>

      <template v-if="signOutError" #error>{{ signOutError }}</template>

      <template #actions>
        <AppButton type="button" :disabled="signingOut" @click="closeSignOutDialog" variant="text">
          {{ t('settings_sign_out_cancel') }}
        </AppButton>
      </template>
    </AppModal>

    <AppConfirmModal
      :open="deleteAccountDialogOpen"
      :title="t('settings_privacy_delete_account')"
      :description="t('settings_privacy_delete_account_hint')"
      :body="t('settings_privacy_delete_account_confirm')"
      :cancel-label="t('settings_sign_out_cancel')"
      :confirm-label="t('settings_privacy_delete_account')"
      :confirm-loading-label="t('settings_privacy_working')"
      confirm-tone="danger"
      :error="dataError || undefined"
      :loading="dataWorking"
      @close="closeDeleteAccountDialog"
      @confirm="confirmDeleteAccount"
    />

    <AppConfirmModal
      :open="confirmDialogOpen"
      :title="confirmDialogTitle"
      :body="confirmDialogBody"
      :cancel-label="t('settings_sign_out_cancel')"
      :confirm-label="confirmDialogTitle"
      :confirm-tone="confirmDialogTone"
      :error="confirmDialogError || undefined"
      :loading="confirmDialogLoading"
      @close="closeConfirmDialog"
      @confirm="runConfirmDialog"
    />
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
  padding: var(--page-shell-padding-top) var(--page-shell-padding-x)
    var(--page-shell-padding-bottom-compact);
  color: var(--on-surface);
  overflow: hidden;
}

.settings-header {
  flex-shrink: 0;
  margin-bottom: var(--space-lg);
}

.settings-header-top {
  margin-bottom: var(--space-2xs);
}

.settings-title {
  margin: 0 0 var(--space-xs);
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
  gap: var(--space-lg);
  grid-template-columns: 160px minmax(0, 1fr);
  min-height: 0;
}

.settings-section-tabs {
  align-self: start;
}

.settings-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden auto;
}

.settings-block + .settings-block {
  margin-top: var(--page-shell-padding-top);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border);
}

.settings-section-head {
  margin-bottom: var(--space-md);
}

.settings-section-title {
  margin: 0 0 var(--space-2xs);
  font-size: 16px;
  line-height: 1.3;
}

.settings-block--placeholder .settings-section-title {
  margin-bottom: var(--space-xs);
}

.settings-section-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

/** 设置页卡片纵向堆叠：块间距统一用 --space-sm */
.settings-card-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.settings-card-stack--spaced {
  margin-top: var(--space-md);
}

.settings-toggle,
.settings-orphan {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
}

.settings-toggle-copy {
  display: grid;
  gap: var(--space-2xs);
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
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  color: var(--on-surface-muted);
}

.settings-error {
  margin: var(--space-sm) 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--danger);
}

.settings-command-list {
  display: grid;
  gap: var(--space-sm);
  margin: 0 0 var(--space-md);
  padding: 0;
  list-style: none;
}

.settings-command-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
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
  padding: var(--space-xs) var(--space-sm);
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
  gap: var(--space-sm);
}

.settings-actions--spaced {
  margin-top: var(--space-md);
}

.settings-subsection {
  margin-top: var(--space-lg);
}

.settings-subsection-title {
  margin: 0 0 var(--space-sm);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.settings-status-strip {
  margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-status-strip__line {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--on-surface-muted);
  font-variant-numeric: tabular-nums;
}

.settings-status-strip__line + .settings-status-strip__line {
  margin-top: var(--space-2xs);
}

.settings-status-strip__line--account {
  color: var(--on-surface);
}

.settings-status-strip--spaced {
  margin-top: var(--space-md);
}

.settings-details {
  margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-details__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--on-surface);
  cursor: pointer;
  list-style: none;
}

.settings-details__summary-label {
  min-width: 0;
}

.settings-details__summary::-webkit-details-marker {
  display: none;
}

.settings-details__chevrons {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: var(--on-surface-muted);
}

.settings-details__chevron--up {
  display: none;
}

.settings-details[open] .settings-details__chevron--down {
  display: none;
}

.settings-details[open] .settings-details__chevron--up {
  display: inline-flex;
}

.settings-details__summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.settings-details__lead {
  margin: var(--space-xs) 0 var(--space-2xs);
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.settings-details__list {
  margin: var(--space-xs) 0 0;
  padding-left: 1.15rem;
  font-size: 12px;
  line-height: 1.45;
  color: var(--on-surface-muted);
}

.settings-orphan-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.settings-orphan-copy {
  margin: var(--space-2xs) 0 var(--space-sm);
}

.settings-sync-counts {
  margin: var(--space-sm) 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--on-surface-muted);
}

.settings-sign-out-options {
  display: grid;
  gap: var(--space-xs);
  margin: var(--space-sm) 0 0;
}

.settings-sign-out-option-hint {
  margin: 0 0 var(--space-sm);
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

@media (width <= 640px) {
  .settings-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
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
