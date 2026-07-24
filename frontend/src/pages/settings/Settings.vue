<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  formatExtensionCommandShortcut,
  getExtensionCommandDisplayTitle
} from '@/core/commands/command-display'
import type { ExtensionCommandInfo } from '@/core/messaging/commands-messages'
import {
  fetchExtensionCommands,
  openChromeShortcutsPage
} from '@/infrastructure/messaging/background-client'

defineOptions({ name: 'SettingsPage' })

type CommandsLoadState = 'loading' | 'ready' | 'error'

const commands = ref<ExtensionCommandInfo[]>([])
const commandsState = ref<CommandsLoadState>('loading')
const commandsError = ref('')
const openingShortcuts = ref(false)
const openShortcutsError = ref('')

const commandRows = computed(() =>
  commands.value.map(command => ({
    name: command.name,
    title: getExtensionCommandDisplayTitle(command),
    shortcutLabel: formatExtensionCommandShortcut(command.shortcut),
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
    commandsError.value = error instanceof Error ? error.message : '读取快捷键失败'
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
    openShortcutsError.value = error instanceof Error ? error.message : '打开快捷键设置失败'
  } finally {
    openingShortcuts.value = false
  }
}

onMounted(() => {
  void loadCommands()
})
</script>

<template>
  <main class="settings-shell">
    <header class="settings-header">
      <p class="settings-eyebrow">Yiveno</p>
      <h1 class="settings-title">设置</h1>
      <p class="settings-subtitle">管理找回相关偏好。未上线能力不会假装可用。</p>
    </header>

    <section class="settings-section" aria-labelledby="settings-shortcuts-heading">
      <div class="settings-section-head">
        <h2 id="settings-shortcuts-heading" class="settings-section-title">快捷键</h2>
        <p class="settings-section-copy">
          扩展无法在本页直接改键；可查看当前绑定，并前往 Chrome 原生快捷键页修改。
        </p>
      </div>

      <p v-if="commandsState === 'loading'" class="settings-status" role="status">
        正在读取快捷键…
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
        <button
          class="settings-primary"
          type="button"
          :disabled="openingShortcuts"
          @click="handleOpenShortcutsPage"
        >
          {{ openingShortcuts ? '正在打开…' : '在 Chrome 中更改快捷键' }}
        </button>
        <button
          class="settings-secondary"
          type="button"
          :disabled="commandsState === 'loading'"
          @click="loadCommands"
        >
          刷新
        </button>
      </div>
      <p v-if="openShortcutsError" class="settings-error" role="alert">{{ openShortcutsError }}</p>
    </section>

    <section
      class="settings-section settings-section--muted"
      aria-labelledby="settings-later-heading"
    >
      <h2 id="settings-later-heading" class="settings-section-title">后续分区</h2>
      <ul class="settings-upcoming-list">
        <li>隐私 — 未上线</li>
        <li>同步 — 未上线</li>
        <li>AI — 未上线</li>
        <li>账户 — 未上线</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.settings-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 24px 40px;
  color: #17202a;
}

.settings-header {
  margin-bottom: 28px;
}

.settings-eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
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
  color: #52606d;
}

.settings-section {
  margin-bottom: 24px;
  padding: 18px;
  border: 1px solid #dbe3ea;
  border-radius: 14px;
  background: #fff;
}

.settings-section--muted {
  background: #f8fafc;
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
  color: #64748b;
}

.settings-status {
  margin: 0 0 12px;
  font-size: 13px;
  color: #64748b;
}

.settings-error {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: #b42318;
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
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
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
  color: #94a3b8;
  word-break: break-all;
}

.settings-command-shortcut {
  flex-shrink: 0;
  margin: 0;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #0e7490;
  background: #e0f2fe;
}

.settings-command-shortcut--unbound {
  color: #b45309;
  background: #fff7ed;
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.settings-primary,
.settings-secondary {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.settings-primary {
  border: none;
  color: #fff;
  background: #0891b2;
}

.settings-primary:disabled,
.settings-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.settings-primary:not(:disabled):hover {
  background: #0e7490;
}

.settings-secondary {
  border: 1px solid #cbd5e1;
  color: #334155;
  background: #fff;
}

.settings-secondary:not(:disabled):hover {
  background: #eef2f6;
}

.settings-upcoming-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: #64748b;
}
</style>
