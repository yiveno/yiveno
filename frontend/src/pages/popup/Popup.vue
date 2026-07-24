<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { getChromeBookmarkImportPercent } from '@/core/memory/chrome-bookmark-import-state'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { formatMatchedFields, getMemoryItemDisplay } from '@/core/recall/recall-result'
import {
  fetchChromeBookmarkImportStatus,
  recallWithClue
} from '@/infrastructure/messaging/background-client'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'

defineOptions({ name: 'PopupPage' })

type RecallViewState = 'idle' | 'loading' | 'result' | 'no_match' | 'error'

const clue = ref('')
const viewState = ref<RecallViewState>('idle')
const recallResult = ref<RecallResult | null>(null)
const errorMessage = ref('')
const importState = ref<ChromeBookmarkImportState | null>(null)

let importPollTimer: ReturnType<typeof setInterval> | null = null

const importProgressPercent = computed(() => {
  if (!importState.value) {
    return 0
  }
  return getChromeBookmarkImportPercent(importState.value)
})

const showImportProgress = computed(() => {
  const status = importState.value?.status
  return status === 'running' || status === 'failed'
})

const importProgressLabel = computed(() => {
  const state = importState.value
  if (!state) {
    return ''
  }
  if (state.status === 'failed') {
    return state.error ?? '书签导入失败，请重新加载扩展后重试'
  }
  if (state.totalCount && state.totalCount > 0) {
    return `正在导入书签 ${state.importedCount} / ${state.totalCount}`
  }
  return '正在导入书签…'
})

async function refreshImportStatus() {
  const response = await fetchChromeBookmarkImportStatus()
  if (!response.ok) {
    return
  }
  importState.value = response.state

  if (response.state?.status === 'completed' || response.state?.status === 'failed') {
    stopImportPolling()
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

onMounted(() => {
  startImportPolling()
})

onUnmounted(() => {
  stopImportPolling()
})

const topPickDisplay = computed(() => {
  const match = recallResult.value?.topPick
  return match ? toMatchCard(match) : null
})

const alsoPossibleCards = computed(() => {
  return (recallResult.value?.alsoPossible ?? []).map(toMatchCard)
})

function toMatchCard(match: RecallMatch) {
  const display = getMemoryItemDisplay(match.item)
  return {
    id: match.item.id,
    title: display.title,
    subtitle: display.subtitle,
    url: display.url,
    excerpt: display.excerpt,
    typeLabel: display.typeLabel,
    reason: formatMatchedFields(match.matchedFields)
  }
}

async function handleRecallSubmit() {
  const trimmed = clue.value.trim()
  if (!trimmed) {
    return
  }

  viewState.value = 'loading'
  errorMessage.value = ''
  recallResult.value = null

  try {
    const response = await recallWithClue({ clue: trimmed })
    if (!response.ok) {
      viewState.value = 'error'
      errorMessage.value = response.error
      return
    }

    recallResult.value = response.result
    viewState.value = response.result.outcome === 'no_match' ? 'no_match' : 'result'
  } catch (error) {
    viewState.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '找回失败，请稍后再试'
  }
}

async function handleOpenSettings() {
  try {
    await openExtensionOptionsPage()
  } catch {
    errorMessage.value = '无法打开设置页'
    viewState.value = 'error'
  }
}
</script>

<template>
  <main class="recall-shell">
    <header class="recall-header">
      <div class="recall-header-top">
        <p class="recall-eyebrow">Yiveno</p>
        <md-text-button type="button" @click="handleOpenSettings">设置</md-text-button>
      </div>
      <h1 class="recall-title">找到它！</h1>
      <p class="recall-subtitle">在你存过的东西里找，不用再去网上搜。</p>

      <section
        v-if="showImportProgress"
        class="recall-import"
        :class="{ 'recall-import--error': importState?.status === 'failed' }"
        aria-live="polite"
      >
        <p class="recall-import-label">{{ importProgressLabel }}</p>
        <md-linear-progress
          v-if="importState?.status === 'running'"
          :value="importProgressPercent / 100"
          aria-label="书签导入进度"
        />
      </section>
    </header>

    <form class="recall-form" @submit.prevent="handleRecallSubmit">
      <label class="recall-label" for="recall-clue">还记得的任意一点线索</label>
      <textarea
        id="recall-clue"
        v-model="clue"
        class="recall-input"
        rows="3"
        placeholder="例如：上周那篇讲留存的、某个产品的分析…"
      />
      <md-filled-button type="submit" :disabled="!clue.trim() || viewState === 'loading'">
        {{ viewState === 'loading' ? '正在找回…' : '开始找回' }}
      </md-filled-button>
    </form>

    <p v-if="viewState === 'loading'" class="recall-status" role="status">正在你的记忆库里筛选…</p>

    <p v-else-if="viewState === 'error'" class="recall-error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-else-if="viewState === 'no_match'" class="recall-empty" aria-live="polite">
      <p class="recall-empty-title">还没找到匹配的</p>
      <p class="recall-empty-copy">
        试试更短的关键词；也可右键保存选区，或先用 Chrome 加书签后等待同步。
      </p>
    </section>

    <section
      v-else-if="viewState === 'result' && topPickDisplay"
      class="recall-results"
      aria-live="polite"
    >
      <div class="recall-top-pick">
        <p class="recall-section-label">最可能的结果</p>
        <a
          class="recall-card recall-card--top"
          :href="topPickDisplay.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div class="recall-card-meta">
            <span class="recall-type">{{ topPickDisplay.typeLabel }}</span>
            <span class="recall-reason">{{ topPickDisplay.reason }}</span>
          </div>
          <h2 class="recall-card-title">{{ topPickDisplay.title }}</h2>
          <p class="recall-card-subtitle">{{ topPickDisplay.subtitle }}</p>
          <p v-if="topPickDisplay.excerpt" class="recall-card-excerpt">
            {{ topPickDisplay.excerpt }}
          </p>
        </a>
        <p class="recall-affirmation">对，就是这个？点卡片打开看看。</p>
      </div>

      <div v-if="alsoPossibleCards.length > 0" class="recall-also">
        <p class="recall-section-label">也可能是这些</p>
        <ul class="recall-also-list">
          <li v-for="item in alsoPossibleCards" :key="item.id">
            <a class="recall-card" :href="item.url" target="_blank" rel="noopener noreferrer">
              <div class="recall-card-meta">
                <span class="recall-type">{{ item.typeLabel }}</span>
                <span class="recall-reason">{{ item.reason }}</span>
              </div>
              <h3 class="recall-card-title recall-card-title--compact">{{ item.title }}</h3>
              <p class="recall-card-subtitle">{{ item.subtitle }}</p>
            </a>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
.recall-shell {
  width: 360px;
  padding: 20px;
  color: var(--md-sys-color-on-background);
  background: var(--md-sys-color-background);
}

.recall-header {
  margin-bottom: 16px;
}

.recall-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.recall-eyebrow {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-title {
  margin: 0 0 8px;
  font-size: 24px;
  line-height: 1.2;
}

.recall-subtitle {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-import {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 10px);
  background: var(--md-sys-color-surface-container-lowest);
}

.recall-import--error {
  border-color: var(--md-sys-color-error-container);
  background: var(--md-sys-color-error-container);
}

.recall-import-label {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-import--error .recall-import-label {
  color: var(--md-sys-color-on-error-container);
}

.recall-form {
  display: grid;
  gap: 10px;
}

.recall-label {
  font-size: 13px;
  font-weight: 600;
}

.recall-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-medium, 10px);
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  color: inherit;
  background: var(--md-sys-color-surface-container-lowest);
  resize: vertical;
}

.recall-input:focus {
  border-color: var(--md-sys-color-primary);
  outline: 2px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.recall-status {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-error {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-error);
}

.recall-empty {
  margin-top: 16px;
  padding: 14px;
  border: 1px dashed var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-lowest);
}

.recall-empty-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
}

.recall-empty-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-results {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.recall-section-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-top-pick {
  display: grid;
  gap: 8px;
}

.recall-affirmation {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-tertiary);
}

.recall-card {
  display: block;
  padding: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  text-decoration: none;
  color: inherit;
  background: var(--md-sys-color-surface-container-lowest);
}

.recall-card--top {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
}

.recall-card:hover {
  background: var(--md-sys-color-surface-container-high);
}

.recall-card--top:hover {
  background: color-mix(
    in srgb,
    var(--md-sys-color-primary-container) 88%,
    var(--md-sys-color-primary) 12%
  );
}

.recall-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.recall-type {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.recall-reason {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-card-title {
  margin: 0 0 4px;
  font-size: 16px;
  line-height: 1.35;
}

.recall-card-title--compact {
  font-size: 14px;
}

.recall-card-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-card-excerpt {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface);
}

.recall-also-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
