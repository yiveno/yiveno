<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import {
  formatExtensionCommandShortcut,
  getExtensionCommandDisplayTitle
} from '@/core/commands/command-display'
import type { ExtensionCommandInfo } from '@/core/messaging/commands-messages'
import {
  authSignOut,
  fetchAuthState,
  fetchExtensionCommands,
  fetchSyncStatus,
  fetchUserSettings,
  openChromeShortcutsPage,
  setSyncEnabled,
  syncReplaceWithLocal,
  syncReplaceWithRemote,
  updateUserSettings
} from '@/infrastructure/messaging/background-client'
import type { AuthSignOutMode } from '@/core/messaging/account-sync-messages'
import {
  tAccountSyncError,
  tCommandsError,
  tSettingsError
} from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'
import { asMdSwitchElement } from '@/infrastructure/ui/register-material-web'

defineOptions({ name: 'SettingsPage' })

type LoadState = 'loading' | 'ready' | 'error'

const commands = ref<ExtensionCommandInfo[]>([])
const commandsState = ref<LoadState>('loading')
const commandsError = ref('')
const openingShortcuts = ref(false)
const openShortcutsError = ref('')
/** 已打开原生快捷键页，待用户返回后静默刷新绑定。 */
const awaitingShortcutsReturn = ref(false)

const selectionToolbarEnabled = ref(true)
const settingsState = ref<LoadState>('loading')
const settingsError = ref('')
const savingSelectionToolbar = ref(false)

const signedIn = ref(false)
const accountEmail = ref('')

const syncEnabled = ref(false)
const syncLocalCount = ref(0)
const syncAccountOwnerCount = ref(0)
const syncLocalProfileOwnerCount = ref(0)
const syncRemoteCount = ref(0)
const needsConflictChoice = ref(false)
const savingSync = ref(false)
const syncWorking = ref(false)
const syncError = ref('')

const signOutDialogOpen = ref(false)
const signingOut = ref(false)
const signOutError = ref('')
/** 最近一次成功 push / pull（用于判断是否已有云端备份）。 */
const syncLastPushedAt = ref<string | undefined>(undefined)
const syncLastPulledAt = ref<string | undefined>(undefined)

/** 退出相关：本机当前账号桶 + 未 remap 的本地档。 */
const signOutLocalCount = computed(
  () => syncAccountOwnerCount.value + syncLocalProfileOwnerCount.value
)

/**
 * 是否认为本地已有云端备份（启发式，无逐条 dirty 位）。
 * 云端条数 > 0 且曾成功 push 或 pull。
 */
const hasCloudBackupForSignOut = computed(
  () => syncRemoteCount.value > 0 && Boolean(syncLastPushedAt.value || syncLastPulledAt.value)
)

/** 规则 3：本地有数且尚无可靠云端备份 → 需要「先同步再清」。 */
const showSignOutSyncThenClear = computed(
  () => signOutLocalCount.value > 0 && !hasCloudBackupForSignOut.value
)

/** 规则 2/3：本地有数才显示「清除本机」。 */
const showSignOutClearLocal = computed(() => signOutLocalCount.value > 0)

const commandRows = computed(() =>
  commands.value.map(command => ({
    name: command.name,
    title: getExtensionCommandDisplayTitle(command, t),
    shortcutLabel: formatExtensionCommandShortcut(command.shortcut, t),
    unbound: command.shortcut.trim().length === 0
  }))
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
  needsConflictChoice.value = response.needsConflictChoice
}

async function loadSyncContext() {
  syncError.value = ''

  try {
    const response = await fetchAuthState()
    if (!response.ok) {
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }

    signedIn.value = response.signedIn
    accountEmail.value = response.email?.trim() ?? ''
    syncEnabled.value = response.syncPrefs.enabled
    syncLastPushedAt.value = response.syncPrefs.lastPushedAt
    syncLastPulledAt.value = response.syncPrefs.lastPulledAt

    if (response.signedIn) {
      await refreshSyncStatus()
    } else {
      syncLocalCount.value = 0
      syncAccountOwnerCount.value = 0
      syncLocalProfileOwnerCount.value = 0
      syncRemoteCount.value = 0
      needsConflictChoice.value = false
      syncLastPushedAt.value = undefined
      syncLastPulledAt.value = undefined
    }
  } catch {
    syncError.value = t('settings_error_auth_state')
  }
}

/** 从其它标签（如官网登录）返回时刷新同步相关登录态。 */
function refreshSyncContextOnVisible() {
  if (document.visibilityState !== 'visible') {
    return
  }
  void loadSyncContext()
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

  const nextValue = switchEl.selected
  savingSync.value = true
  syncError.value = ''
  try {
    const response = await setSyncEnabled(nextValue)
    if (!response.ok) {
      switchEl.selected = !nextValue
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }
    syncEnabled.value = response.syncPrefs.enabled
    syncLocalCount.value = response.localCount
    syncRemoteCount.value = response.remoteCount
    needsConflictChoice.value = response.needsConflictChoice
  } catch {
    switchEl.selected = !nextValue
    syncError.value = t('settings_error_sync_prefs')
  } finally {
    savingSync.value = false
  }
}

async function handleReplaceWithLocal() {
  syncWorking.value = true
  syncError.value = ''
  try {
    const response = await syncReplaceWithLocal()
    if (!response.ok) {
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }
    await refreshSyncStatus()
  } catch {
    syncError.value = t('settings_error_sync_replace_local')
  } finally {
    syncWorking.value = false
  }
}

async function handleReplaceWithRemote() {
  syncWorking.value = true
  syncError.value = ''
  try {
    const response = await syncReplaceWithRemote()
    if (!response.ok) {
      syncError.value = tAccountSyncError(response.errorCode)
      return
    }
    await refreshSyncStatus()
  } catch {
    syncError.value = t('settings_error_sync_replace_remote')
  } finally {
    syncWorking.value = false
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
  if (mode === 'sync_then_clear_local' && !showSignOutSyncThenClear.value) {
    signOutError.value = t('settings_sign_out_sync_then_clear_disabled')
    return
  }
  if (mode === 'clear_local' && !showSignOutClearLocal.value) {
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
    needsConflictChoice.value = false
    syncLastPushedAt.value = undefined
    syncLastPulledAt.value = undefined
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

    <section class="settings-section" aria-labelledby="settings-capture-heading">
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

      <div v-else class="settings-toggle">
        <div class="settings-toggle-copy">
          <span class="settings-toggle-title">{{ t('settings_toggle_selection_toolbar') }}</span>
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
      <p v-if="settingsState === 'ready' && settingsError" class="settings-error" role="alert">
        {{ settingsError }}
      </p>
    </section>

    <section class="settings-section" aria-labelledby="settings-shortcuts-heading">
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
            <p class="settings-command-name">{{ row.name }}</p>
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
          :title="openingShortcuts ? t('settings_opening_shortcuts') : t('settings_open_shortcuts')"
          @click="handleOpenShortcutsPage"
        >
          <MaterialSymbolIcon name="open_in_new" size="18px" slot="icon" />
          {{ openingShortcuts ? t('settings_opening_shortcuts') : t('settings_open_shortcuts') }}
        </md-filled-button>
      </div>
      <p v-if="openShortcutsError" class="settings-error" role="alert">{{ openShortcutsError }}</p>
    </section>

    <section class="settings-section" aria-labelledby="settings-sync-heading">
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
          :disabled="savingSync || syncWorking || !signedIn"
          @change="handleSyncToggle"
        />
      </div>

      <p v-if="signedIn" class="settings-sync-counts">
        {{ t('settings_sync_local_count', [String(syncLocalCount)]) }}
        ·
        {{ t('settings_sync_remote_count', [String(syncRemoteCount)]) }}
      </p>
      <p v-else class="settings-status">{{ t('settings_sync_sign_in_required') }}</p>

      <div v-if="signedIn" class="settings-actions">
        <md-outlined-button
          type="button"
          :disabled="signingOut || syncWorking || savingSync"
          :title="t('settings_account_sign_out')"
          @click="openSignOutDialog"
        >
          {{ signingOut ? t('settings_account_signing_out') : t('settings_account_sign_out') }}
        </md-outlined-button>
      </div>

      <div v-if="needsConflictChoice" class="settings-sync-conflict">
        <p class="settings-toggle-title">{{ t('settings_sync_conflict_title') }}</p>
        <p class="settings-section-copy">{{ t('settings_sync_conflict_copy') }}</p>
        <div class="settings-actions">
          <md-filled-button type="button" :disabled="syncWorking" @click="handleReplaceWithLocal">
            {{ syncWorking ? t('settings_sync_working') : t('settings_sync_use_local') }}
          </md-filled-button>
          <md-outlined-button
            type="button"
            :disabled="syncWorking"
            @click="handleReplaceWithRemote"
          >
            {{ syncWorking ? t('settings_sync_working') : t('settings_sync_use_remote') }}
          </md-outlined-button>
        </div>
      </div>
      <p v-if="syncError" class="settings-error" role="alert">{{ syncError }}</p>
    </section>

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

          <template v-if="showSignOutClearLocal">
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
          </template>

          <template v-if="showSignOutSyncThenClear">
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

    <section
      class="settings-section settings-section--muted"
      aria-labelledby="settings-later-heading"
    >
      <h2 id="settings-later-heading" class="settings-section-title">
        {{ t('settings_section_later') }}
      </h2>
      <ul class="settings-upcoming-list">
        <li>{{ t('settings_upcoming_privacy') }}</li>
        <li>{{ t('settings_upcoming_ai') }}</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.settings-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 24px 40px;
  color: var(--md-sys-color-on-background);
}

.settings-header {
  margin-bottom: 28px;
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
  color: var(--md-sys-color-on-surface-variant);
}

.settings-section {
  margin-bottom: 24px;
  padding: 18px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-lowest);
}

.settings-section--muted {
  background: var(--md-sys-color-surface-container-low);
}

.settings-section-head {
  margin-bottom: 14px;
}

.settings-section-title {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.3;
}

.settings-section-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
}

.settings-toggle {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-low);
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
  color: var(--md-sys-color-on-surface-variant);
}

.settings-status {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.settings-error {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-error);
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
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-low);
}

.settings-command-meta {
  min-width: 0;
}

.settings-command-title {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 600;
}

.settings-command-name {
  margin: 0;
  font-size: 12px;
  color: var(--md-sys-color-outline);
  word-break: break-all;
}

.settings-command-shortcut {
  flex-shrink: 0;
  margin: 0;
  padding: 6px 10px;
  border-radius: var(--md-sys-shape-corner-small, 8px);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
}

.settings-command-shortcut--unbound {
  color: var(--md-sys-color-tertiary);
  background: var(--md-sys-color-tertiary-container);
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.settings-sync-counts {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.settings-sync-conflict {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-low);
}

.settings-upcoming-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--md-sys-color-on-surface-variant);
}

.settings-sign-out-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--md-sys-color-scrim, #000) 42%, transparent);
}

.settings-sign-out-dialog {
  width: min(100%, 420px);
  max-height: min(90vh, 640px);
  overflow: auto;
  padding: 20px 18px 16px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-lowest);
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
  color: var(--md-sys-color-on-surface-variant);
}
</style>
