<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  formatExtensionCommandShortcut,
  getExtensionCommandDisplayTitle
} from '@/core/commands/command-display'
import type { ExtensionCommandInfo } from '@/core/messaging/commands-messages'
import {
  fetchExtensionCommands,
  fetchUserSettings,
  openChromeShortcutsPage,
  updateUserSettings
} from '@/infrastructure/messaging/background-client'
import { t } from '@/infrastructure/i18n/t'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import { asMdSwitchElement } from '@/infrastructure/ui/register-material-web'

defineOptions({ name: 'SettingsPage' })

type LoadState = 'loading' | 'ready' | 'error'

const commands = ref<ExtensionCommandInfo[]>([])
const commandsState = ref<LoadState>('loading')
const commandsError = ref('')
const openingShortcuts = ref(false)
const openShortcutsError = ref('')

const selectionToolbarEnabled = ref(true)
const settingsState = ref<LoadState>('loading')
const settingsError = ref('')
const savingSelectionToolbar = ref(false)

const commandRows = computed(() =>
  commands.value.map(command => ({
    name: command.name,
    title: getExtensionCommandDisplayTitle(command, t),
    shortcutLabel: formatExtensionCommandShortcut(command.shortcut, t),
    unbound: command.shortcut.trim().length === 0
  }))
)

async function loadCommands() {
  commandsState.value = 'loading'
  commandsError.value = ''

  try {
    const response = await fetchExtensionCommands()
    if (!response.ok) {
      commandsState.value = 'error'
      commandsError.value = response.error
      return
    }

    commands.value = response.commands
    commandsState.value = 'ready'
  } catch (error) {
    commandsState.value = 'error'
    commandsError.value = error instanceof Error ? error.message : t('settings_error_load_commands')
  }
}

async function handleOpenShortcutsPage() {
  openingShortcuts.value = true
  openShortcutsError.value = ''

  try {
    const response = await openChromeShortcutsPage()
    if (!response.ok) {
      openShortcutsError.value = response.error
    }
  } catch (error) {
    openShortcutsError.value =
      error instanceof Error ? error.message : t('settings_error_open_shortcuts')
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
      settingsError.value = response.error
      return
    }

    selectionToolbarEnabled.value = response.settings.selectionToolbarEnabled
    settingsState.value = 'ready'
  } catch (error) {
    settingsState.value = 'error'
    settingsError.value = error instanceof Error ? error.message : t('settings_error_load')
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
      settingsError.value = response.error
      return
    }

    selectionToolbarEnabled.value = response.settings.selectionToolbarEnabled
  } catch (error) {
    switchEl.selected = !nextValue
    settingsError.value = error instanceof Error ? error.message : t('settings_error_update')
  } finally {
    savingSelectionToolbar.value = false
  }
}

onMounted(() => {
  void loadCommands()
  void loadUserSettings()
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
          @click="handleOpenShortcutsPage"
        >
          {{ openingShortcuts ? t('settings_opening_shortcuts') : t('settings_open_shortcuts') }}
        </md-filled-button>
        <md-outlined-button
          type="button"
          :disabled="commandsState === 'loading'"
          @click="loadCommands"
        >
          {{ t('settings_refresh') }}
        </md-outlined-button>
      </div>
      <p v-if="openShortcutsError" class="settings-error" role="alert">{{ openShortcutsError }}</p>
    </section>

    <section
      class="settings-section settings-section--muted"
      aria-labelledby="settings-later-heading"
    >
      <h2 id="settings-later-heading" class="settings-section-title">
        {{ t('settings_section_later') }}
      </h2>
      <ul class="settings-upcoming-list">
        <li>{{ t('settings_upcoming_privacy') }}</li>
        <li>{{ t('settings_upcoming_sync') }}</li>
        <li>{{ t('settings_upcoming_ai') }}</li>
        <li>{{ t('settings_upcoming_account') }}</li>
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

.settings-upcoming-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
